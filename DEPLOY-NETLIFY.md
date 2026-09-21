# Netlify deployment

This folder is the whole project and deploys as a Next.js app with server routes
(`/api/ask`, `/api/explain`, `/api/search`), so it needs a host that runs Node —
Netlify does this through its Next.js runtime.

```
samvidhan-saral/
├── netlify.toml          ← build settings (command, publish directory, Node 20)
├── package.json          ← the Next.js app, at the repository root
├── app/ components/ lib/ ← the application
├── data/samvidhan.db     ← the verified database (13.8 MB, read-only at runtime)
├── scripts/              ← build helpers (database hand-off, deployment check)
└── pipeline/             ← how the database was built (not needed to deploy)
```

**Why the app sits at the repository root.** Netlify's Next.js runtime builds a
`.next/standalone` bundle and then, in its `onBuild` step, maps the
`node_modules` inside that bundle back through the build's tracing root to
recreate package symlinks. The mapping only lands on a real directory when the
app directory is the directory `npm install` writes into. With the app in a
subdirectory (`base = "src"`) and a lockfile at the root, Next.js chose the
repository as its tracing root — from its own comment, *"use the closest
lockfile as tracing root"* — and the runtime then asked for
`/opt/build/repo/node_modules`, which does not exist, failing the build with
`ENOENT` after a successful compile. At the root, that path is exactly where the
dependencies are installed, so the mapping cannot miss. `next.config.mjs` also
pins `experimental.outputFileTracingRoot` to the app directory, so no lockfile
layout can move it.

## Deploy in one command (macOS, Linux, WSL)

```bash
npm install -g netlify-cli      # once
bash deploy.sh                  # installs, builds, checks, deploys
```

`deploy.sh` verifies the build the Netlify runtime will consume (tracing root,
`node_modules` mapping, the database in the bundle, every API route's traced
files) and only then hands over to `netlify deploy --prod`.

On Windows, use Option A below instead: the database driver is a native module,
so the build has to happen on Linux — and Netlify's own builders are Linux.

## Option A — connect the folder to Netlify (recommended)

1. Put this folder in a Git repository (GitHub/GitLab/Bitbucket) and push it.
   `data/samvidhan.db` is 13.8 MB — under every Git host's file-size limit, so it
   can be committed as it is (no Git LFS needed). Keep `package-lock.json`
   committed too: the install must be reproducible.
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
3. Leave the build fields at their defaults — `netlify.toml` supplies them:
   build command `npm run build`, publish directory `.next`, no base directory.
4. Deploy. Netlify builds on Linux, which matters: `better-sqlite3` is a native
   module, and a build made on Windows or macOS produces a binary its servers
   cannot load. Letting Netlify build avoids that entirely.

## Option B — Netlify CLI

```bash
npm install -g netlify-cli
cd samvidhan-saral
netlify login
netlify init
netlify deploy --prod          # Netlify builds on Linux
```

If you build locally first (`netlify deploy --build --prod`), do it from Linux or
WSL, or the native `better-sqlite3` binary will not match the runtime.

## Option C — a static drop will not work

Dragging a folder onto Netlify Drop publishes static files only. The assistant
answers through `/api/ask`, which reads the database on the server.

## Before you push

```bash
npm run verify:netlify     # builds in standalone mode, then checks the bundle
```

It reproduces the runtime's own path arithmetic from the build manifests — the
same `outputFileTracingRoot ?? relativeAppDir depth ?? cwd` chain as
`@netlify/plugin-nextjs/dist/build/plugin-context.js` — and fails if the plugin
would read a path that does not exist, if the tracing root is not the app
directory, if the database is missing from the app directory or the bundle, or if
it is missing from any API route's traced files. `npm run build` also runs the
same check as a `postbuild` step, so a misconfigured build fails with an
explanation instead of a plugin stack trace.

`next build` writes to the same `.next` directory a running `next dev` uses — stop
the dev server first, then restart it. Netlify builds on a clean checkout, so this
only matters locally.

## Checking a deployment

* `/status` shows the data version, row counts and source coverage.
* `POST /api/ask {"q":"What is the punishment for murder?","lang":"en"}` should
  answer; so should `{"q":"गिरफ्तारी के समय मेरे क्या अधिकार हैं?","lang":"hi"}`.
* `/ask` — the assistant. Try *"Can the police search my house?"*, *"झडती कधी
  घेतली जाऊ शकते?"*, *"Mere privacy ka right kya hai?"* (English letters, Hindi
  answer) and something nonsense — the last must refuse.
* The 🖍 **Highlighter** control in the assistant header marks the words your
  question was searched with; switching it off leaves the text untouched.

## If something goes wrong

* **`Could not locate the bindings file` / `invalid ELF header`** — the
  `better-sqlite3` binary was built for another platform. Let Netlify do the
  build, or rebuild with `npm install --os=linux --cpu=x64`.
* **`SQLITE_CANTOPEN`** — the database did not reach the bundle. Confirm
  `data/samvidhan.db` is committed (it is *not* gitignored) and that
  `npm run verify:netlify` passes.
* **`ENOENT … scandir '.../node_modules'`** — the deployed source still has the
  old layout. Check that `package.json` and `netlify.toml` are at the repository
  root (not inside `src/`) and that `next.config.mjs` contains
  `outputFileTracingRoot: appDir`.
* **A page shows an old answer** — nothing is cached except the read-only
  database handle; a redeploy picks up a new database.

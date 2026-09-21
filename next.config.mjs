import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The Next.js app directory — the directory this file sits in. */
const appDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // a native module, so it must not be bundled by webpack
    serverComponentsExternalPackages: ['better-sqlite3'],

    /**
     * Pinned to this directory, deliberately.
     *
     * Left unset, Next.js sets the tracing root to the directory of the closest
     * lockfile it finds walking *up* from here ("use the closest lockfile as
     * tracing root" — next/dist/server/config.js). If that search passes this
     * directory and finds a lockfile at the repository root instead, the tracing
     * root becomes the repository.
     *
     * Netlify's Next.js runtime then breaks: in its `onBuild` step it walks the
     * standalone bundle for `node_modules` and maps each one back through this
     * root to recreate package symlinks. If the root moves up while the
     * dependencies stay here, the build dies after a successful compile with
     * `ENOENT: no such file or directory, scandir '.../node_modules'`.
     *
     * The application sits at the repository root, so the app directory *is* the
     * directory `npm install` writes into, and the mapping lands on the real
     * `node_modules` either way. Pinning it here keeps that true whatever
     * lockfile layout the host has.
     */
    outputFileTracingRoot: appDir,

    /**
     * The verified database sits in `data/`, inside this directory, which is
     * where the pipeline writes it. `npm run build` folds its write-ahead log in
     * first (scripts/prepare-db.mjs) and the pattern below carries the file into
     * every server bundle.
     */
    outputFileTracingIncludes: {
      '/**': ['data/samvidhan.db'],
    },
  },
};

export default nextConfig;

# Samvidhan Saral (संविधान सरल)

A citizen-facing, trilingual reader for **the Constitution of India**, and a
section-by-section reader for the three criminal statutes — the **Bharatiya
Nyaya Sanhita, 2023 (BNS)**, the **Bharatiya Nagarik Suraksha Sanhita, 2023
(BNSS)** and the **Bharatiya Sakshya Adhiniyam, 2023 (BSA)**.

One database, four documents, kept strictly apart: constitutional Articles and
statutory sections are never blended. Every provision carries the official text
taken from the uploaded PDF, a clearly-labelled derived explanation, its source
page, and its verification status. The public `/status` page reports what has
been verified and what has not.

```
samvidhan-saral/
├── pipeline/          Python data pipeline (PDFs → validated JSON + SQL)
├── data/
│   ├── raw/           raw extraction output
│   ├── curated/       editorial layer + verification side-cars
│   ├── build/         constitution.json, bns.json, bnss.json, bsa.json,
│   │                  statute_provisions.json, statute_schedules.json
│   ├── unified/       THE DELIVERABLES (unified_legal_database.json,
│   │                  legal_documents.json, legal_provisions.json,
│   │                  provision_relationships.json, other_acts.json,
│   │                  validation_report.json, database_schema.sql, pg/*.csv)
│   ├── reports/       validation reports (per stage)
│   └── samvidhan.db   SQLite database built from data/build + data/unified
├── app/ components/ lib/  Next.js 14 application (App Router, TypeScript, Tailwind)
├── scripts/           build helpers (database hand-off, deployment check)
```

Working notes on the current state of the integration (what was added, how to
reproduce the data, and the checks worth re-running) are in
[`docs/sanhitas-integration.md`](docs/sanhitas-integration.md).

## Quick start

```bash
# 1. data (only needed after changing the pipeline or the editorial layer)
python3 pipeline/extract_articles.py     # PDFs  → data/raw/articles_extracted.json
python3 pipeline/clean.py                # raw   → data/curated/articles.json
python3 pipeline/structure_curated.py    # Parts/Schedules (hand-authored, trilingual)
python3 pipeline/curated_content.py      # editorial batch 1 (62 Articles)
python3 pipeline/curated_content_2.py    # editorial batch 2 (71 Articles)
python3 pipeline/page_refs.py            # verify Hindi/Marathi page references
python3 pipeline/merge.py                # → data/build/constitution.json + reports

# 2. statutes (BNS, BNSS, BSA) from the uploaded official PDFs
python3 pipeline/statutes.py             # → data/build/{bns,bnss,bsa}.json
python3 pipeline/concepts.py             # → data/unified/legal_concepts.json (subject index)
python3 pipeline/unified.py              # → data/unified/*.json + validation report
                                         #   + data/unified/database_schema.sql
python3 pipeline/pg_export.py            # → data/unified/pg/*.csv (COPY-ready)

# 3. application
cd src
npm install
npm run data:build        # → ../data/samvidhan.db (Constitution + the Sanhitas)
npm run dev               # http://localhost:3000
```

`npm run db:init` creates an empty database (schema only).

## The two text layers — and why they are kept apart

| Layer | Column(s) | Rules |
| --- | --- | --- |
| **Official text** | `official_text_en/hi/mr` | Reproduced exactly from an official edition, with the PDF page number. Never paraphrased, never translated by us, never filled with editorial writing. |
| **Simple explanation** | `explanation_en/hi/mr` | Written by this project for students and citizens. Labelled *“for educational purposes”* wherever it appears. It is never presented as law. |

`official_text_status_*` records what has actually been verified, and the app
shows that status to the reader. Two consequences the project deliberately
accepts:

* **Hindi/Marathi official text is not published yet.** Both official PDFs are
  typeset in legacy (pre-Unicode) fonts. Until that conversion is verified
  Article by Article, the reader sees the verified English text plus a *verified
  page reference* to the Hindi/Marathi edition, and the record is marked
  “awaiting verification”. No Devanagari is invented. See
  [`docs/text-verification.md`](docs/text-verification.md).
* **Nothing is hidden.** `/status` lists every Article that is not fully
  verified, together with the automated validation results.

## What the dataset contains today

| | |
| --- | --- |
| Articles (including omitted ones) | 503 records — Articles 1–395 plus lettered Articles such as 21A, 243ZG, 330A |
| Parts and Schedules | 27 Parts/Preamble + 12 Schedules, trilingual titles and summaries |
| Topics (themes) | 15 |
| Simple explanations | 134 Articles (English, Hindi and Marathi) |
| Keywords for search | 3,733, across the three languages |
| Verified page references | English 503, Hindi 415, Marathi 389 |
| Statute sections | 1,061 — BNS 358, BNSS 533, BSA 170 |
| Statute schedules | 3 — BNSS First and Second Schedules, BSA THE SCHEDULE |
| Provision-to-provision references | 1,451 = 954 cross-references found in the Sanhitas (941 to a provision held here — BNSS 684, BNS 165, BSA 82, Constitution 507 — and 13 to legislation not held) + 497 curated *related Articles* pairs from the Constitutional corpus |
| Non-Sanhita legislation cited | 13 citations of 10 other Acts (including two references to repealed Codes), recorded as references only — their text is not held |
| Subject index (concepts) | 28 subjects — privacy, arrest, bail, theft, cyber-offences, … — with 2,750 weighted links to Articles and sections, anchored on the provision each subject is actually about |
| Legacy-code references | 3 provisions that still name the IPC, the CrPC or the Evidence Act, mined from the text and flagged as terminology of repealed codes |
| Derived explanations / keywords | Every one of the 1,061 statute sections carries a rule-based, extractive explanation and keywords; 134 Articles carry editorial explanations in all three languages |
| “What this means for you” notes | **All 1,564 provisions** — 1,061 statute sections and 503 Articles (the 369 Articles without a hand-written explanation included) carry a second rule-based note: what kind of provision it is, who it applies to, any time limit the text prints, and the punishment or liability quoted verbatim |
| Subject vectors | 1,564 vectors / 5,369 terms — an offline tf-idf index over each provision's heading, search words, explanation, citizen note and official text; cosine similarity is used for ranking and the code says plainly that this is **not a neural embedding** |
| Derived-content export | `data/unified/pg/provision_derived_content.csv` — 14,149 rows, one per derived item (explanation, citizen note, keyword), each with its method, generator and disclaimer |

Search uses SQLite FTS5 with the `unicode61` tokenizer, so it matches Devanagari
and Latin text with the same index, over titles, official text, simple
explanations and keywords.  Exact identifiers win: `BNS 103`, `section 103 bns`
and `BNSS 97` return that provision first, marked *exact provision number*.

## Pipeline stages

| Stage | Purpose |
| --- | --- |
| `extract_articles.py` | Locates every Article block in the three official PDFs, splits number/title/body, detects Parts and Schedules. |
| `clean.py` | Normalises text, applies the omission list, drops non-Article noise, writes the validation report. **Does not touch the curated files.** |
| `structure_curated.py` | Hand-authored, trilingual Parts/Schedules with summaries — the authoritative structure layer. |
| `curated_content.py`, `curated_content_2.py` | The editorial layer: 133 Articles with explanations and keywords in English, Hindi and Marathi. |
| `page_refs.py` | Verifies the Hindi and Marathi page references (unique-match rule, see below). |
| `merge.py` | Merges everything, applies the safety rails, validates, and writes `data/build/constitution.json`. |

A page reference is published only when the Article's English text is found on
**exactly one page** of that edition; otherwise the reference is left blank.

## The three Sanhitas

The statute PDFs are extracted by `pipeline/statutes.py` (with
`pipeline/statute_pdf.py` for the layout work).  The rules are the same as for
the Constitution, plus a few the sources force:

* **The document's own arrangement table is the authority for numbering and
  titles.**  Section starts are accepted only when the number is listed in the
  ARRANGEMENT OF SECTIONS/CLAUSES, which keeps footnote and line numbers out.
* **Printed numbering is preserved, never corrected.**  The BNSS Bill prints
  clause 338 twice; the arrangement lists both 337 and 338.  The occurrence whose
  text is that of clause 337 is identified by the marginal note printed beside it
  and stored as section 337, keeping the printed numeral in
  `section_number_as_printed` and carrying a `needs_review` flag, because the
  number is inferred and not printed as stored; the other occurrence keeps 338.
  The conflict is recorded in the validation report.  Nothing is renumbered
  silently and no text is moved between the two records.
* **The BNSS arrangement and body disagree on chapter numerals** (the
  arrangement contains the malformed numeral `XIVIII`, the body prints
  `XVIII`).  Chapters are aligned by position in the sequence, both numberings
  are stored, and the conflict is reported.
* **Page furniture, margin notes and line numbers never enter `official_text`.**
  Marginal notes are stored separately (`margin_notes`), footnotes are stored
  separately (`footnotes`, with page), and printed tables keep their cell
  boundaries as ` | ` (the extractor's documented marker).
* **The BNSS source is the Bill as introduced in Lok Sabha** (Bill No. 122 of
  2023).  It prints no Act number and no assent date, so those fields are empty
  rather than filled from outside the source.
* **Schedules are kept verbatim.**  A tabular schedule is rendered row by row
  from the printed words: rows are banded by vertical position and each word is
  placed in the column it sits in, using the page's vertical corridors as column
  boundaries, so a row reads left to right as printed and a wrapped cell stays
  with its row (` | ` marks the cell boundary, and is documented as the
  extractor's marker, not a character in the source).  Where a page has no
  corridor between columns, that page is left as printed text and no boundary is
  guessed — page numbers, running heads and footnotes never enter the text.
  Entry splits below the text (offence rows, forms, Parts A/B) are machine-derived
  and are published with `structure_verified: false`.

## Derived content (clearly separated from official text)

Every provision with official text carries a machine-generated note built by
`pipeline/derived.py` under a deliberately narrow rule: it may use only the
provision's own title, chapter, printed structure (sub-sections, provisos,
Explanation and Illustration blocks) and short **verbatim** quotations of its
text — never a paraphrase of the law.

```
simple_explanation     "This provision is section 103 of the Bharatiya Nyaya
                        Sanhita, 2023, titled “Punishment for murder” … This
                        provision states: “(1) Whoever commits murder shall be
                        punished with death or imprisonment for life …”"
explanation_status     generated_rule_based
explanation_meta       { method, generator, generated_on, basis, disclaimer }
```

A second note is built the same way and stored beside it — the one the
interface shows under **“What this means for you”**:

```
citizen_note_en        "This is a procedural provision of the Bharatiya Nagarik
                        Suraksha Sanhita, 2023: it lays down what a police
                        officer, a court or another authority is to do, and
                        how … The provision names a police officer and the
                        accused person …"
```

It states only what the provision's own printed text supports: the kind of
provision it is (offence, procedure, power, definition, guarantee), the
provision's printed structure, any time limit the text prints, and — quoted
verbatim — the punishment or liability it provides for. All 1,564 provisions
carry it, including the 369 Articles that have no hand-written explanation.

The disclaimer travels with the text into the database and the interface:
*“Machine-generated summary of the retrieved official text, provided to aid
understanding only. It is not legal advice, it is not a substitute for the
official text, and no outcome is guaranteed.”*

The same content is exported for a SQL loader as
`data/unified/pg/provision_derived_content.csv` — 14,149 rows, one per derived
item, each carrying its `content_type`, its method (`rule_based_extractive`),
its generator (`pipeline/derived.py`) and the disclaimer, so derived content can
never be mistaken for the official text once it is loaded.

## Retrieval (how a question is answered)

`GET /api/search?q=…&document=bnss&limit=5` implements the retrieval contract
used by the interface and by any question-answering client:

1. **intent / concept detection** — the query is mapped to legal concepts
   (arrest, evidence, offences against property, …) so the retrieval can be
   filtered by corpus;
2. **hybrid search** — exact provision identifier first, then full-text
   (`bm25` over title, official text, derived explanation and keywords, with
   column weights that favour the title);
3. **retrieval** — the *full* provision row is returned, with its document,
   chapter, source page and verification status;
4. **rerank** — exact identifier > title match > official text > derived
   explanation/keywords;
5. **answer** — the client must answer only from the returned provisions and
   cite them. When nothing relevant is retrieved, `grounded: false` and the
   instruction *“No sufficiently relevant provision was found in the verified
   database.”* are returned; nothing is answered from memory.

### The assistant (`POST /api/ask`)

`/ask` is a conversation over the same database, and `lib/rag.ts` is the
whole of its reasoning.  It is **extractive**: it writes no legal content, and
every card it shows is a database record or a fixed interface sentence.

`lang` (`en` · `hi` · `mr`) is the language the answer is written in; the question itself may be
in any of the three, or typed with English letters.

1. **understand** — the question is read for a provision named directly
   (*“Article 21”*, *“BNSS 47”*, *“IPC 302”*), for the subjects it is about
   (28 concepts, matched on English, Hindi and Marathi triggers, including
   inflections — *“threatens”* matches the *threats* subject), and for the
   words to search on, including the everyday word for a legal term
   (*“steals”* → *theft*, *“camera”* → *recording*).  The language of the
   question is detected so the reply can say plainly that the official text of
   the Sanhitas is English only and that nothing has been machine-translated.
2. **retrieve** — four channels, each contributing *evidence*, never a
   conclusion: exact identifier (weight 12), concept links (the stored weight,
   scaled by how specific the subject is and boosted when the subject's own
   trigger words are in the question), OR-style full-text search over titles,
   official text, explanations and keywords, and **subject-vector similarity**
   — the question is turned into a tf-idf vector and compared by cosine
   similarity with the 1,564 provision vectors held in `document_vectors`,
   weighted below everything else because a shared word is weaker evidence
   than a named provision or a named subject.
3. **rerank** — exact identifier > anchor provision of a matched subject >
   subject-vector similarity > title match > concept link > full text; a flagged (`needs_review`) record is
   ranked down, never hidden.  A row found only by full-text search must carry
   one of the question's meaningful words in its heading, its keywords or
   the matched text — otherwise it is **discarded**, so a question made of
   general words (*“what is the law about this thing?”*) gets no invented
   matches.  The same gate governs the subject-vector channel, and a question
   with no subject word (*“explain this section simply”*) is answered with the
   guidance card rather than a provision that happens to share a word with it.
   A provision is *directly relevant* only when the question names it, when its
   heading carries two of the question's own words, or when its heading *is* the
   thing asked about; one shared word makes it *potentially relevant* at most.
   The subject index's first choice for the matched subject is always given a
   card, so a cluster of provisions that merely repeat a strong word of the
   question cannot crowd it out.  Questions using the older Codes (IPC / CrPC /
   Evidence Act) get a card quoting the repeal-and-savings section of the
   Sanhita that replaced the Code — the database holds no section-by-section
   correspondence, and none is asserted.
4. **answer** — the cards are assembled in a fixed order: understanding →
   constitutional position → applicable law → why these provisions may be
   relevant → official text → related provisions → **important limitation**.
   Every card shows the provision it came from.  When nothing survives
   retrieval, `grounded: false` and the fixed sentence *“I could not find a
   sufficiently verified provision in the available legal sources to answer
   this confidently.”* are returned, and nothing else is said.

The client sends the provisions of its **previous** answer back with each new
question (`context: [...]` on `POST /api/ask`, or `?context=id,id` on `GET`),
so a follow-up such as *“explain that section in simple language”* is understood.
The server keeps no conversation state of its own — the context travels with the
request — and the answer reports what it carried over in `continuing`.

Each provision card is shown in two labelled parts, both derived and both
labelled as such: **In simple words** (`explanation_en`, rule-based and
extractive) and **What this means for you** (`citizen_note_en`, also rule-based).
The official text is always a separate block, collapsible, with the source page.
The answer also carries a citation block for every source: Act name and number,
year, version, authority, chapter, provision, retrieval route, match score and
verification status.

`GET /api/explain?kind=article|section&id=…` returns the structured
explanation of one provision — official text, the rule-based note with its
disclaimer, keywords, cross-references and source pages.  It never invents an
example: an illustration is shown only when the source itself prints one.

The PostgreSQL/Supabase schema (`data/unified/database_schema.sql`) provides the
same flow in SQL — `hybrid_search(query_text, query_embedding, match_count,
document_filter)` — with a `tsvector` column and GIN index, trigram indexes for
fuzzy title matching, and a **pgvector** column with an HNSW cosine index for
semantic search.  Embeddings are **not** generated by this pipeline: the schema
and the loader provide the hooks, and the embedding job must run with a model of
the operator's choice. Until then, retrieval uses exact and full-text matching
plus the keyword layer, and the app says so.

### Reading aids

A **highlighter** runs over the answer: the words the question was searched
with, and the provisions it named, are marked where they occur — in the quoted
official text, in the plain-language explanation, in "what this means for you".
It marks and never edits: every character is rendered back unchanged, so a
highlighted provision is still the provision as printed. In the short answer the
label before the colon ("Directly relevant", "Constitutional position") is
marked more strongly, because that is the main point of the line. It can be
switched off from the assistant header, and it is translated like the rest of
the interface.

### Deployment

`DEPLOY-NETLIFY.md` describes the Netlify deployment, which is what the shipped
`netlify.toml` and `scripts/prepare-db.mjs` exist for.

### What an answer looks like

Every answer opens with a **short answer**: the provisions the answer rests on,
the relevance word the retrieval produced, and the first operative sentence of
each of those provisions quoted exactly as printed. The full card stack follows
unchanged — understanding, constitutional position, applicable law, why each
provision was retrieved, official text, related provisions, limitations. Nothing
in the short answer is generated from memory; it is a reading of the records
that were retrieved, and it carries the AI-assisted label.

## Three languages, one engine

The platform is the same website in English, हिंदी and मराठी — not three copies and not a
translation layer bolted on top. The interface language travels in the URL (`?lang=hi`) and in a
cookie the middleware sets, so a shared link opens in the language it was read in and nothing ever
drops the reader back into English.

The reader's words are what the engine reads. `lib/lexicon.ts` is the bridge between the three
languages and the English the corpus prints: about a hundred entries mapping Hindi, Marathi and
Roman-script spellings (निजता · गोपनीयता · privacy) onto the terms the provisions themselves use,
with function words separated out so a question's grammar does not become a search term. Devanagari
inflects by appending, so matching compares word stems (`गोपनीयतेत` finds the trigger `गोपनीयता`)
as well as whole words; Devanagari vowel signs are marks, not letters, and are kept when punctuation
is stripped, or every Hindi word would be cut in half.

`expandToCorpusTerms()` widens a word to every term the provisions use for the idea (arrest →
arrested, custody, detention) and feeds the similarity channel; `expandToCanonicalTerms()` narrows
it to the single canonical term (गोपनीयता → privacy) and feeds the keyword index, where a long
synonym list would match nothing. Both read the same map. A word the lexicon does not know is
searched as typed — nothing is guessed into a legal term. Triggers matched from Hindi or Marathi
are weighted by their consonants rather than their code units, because a four-code-unit
Devanagari word is already a whole legal term and was otherwise scored as a generic short word.

The assistant answers in the chosen language: the card headings, the understanding card, the
explanation frames, the follow-up questions and the refusal are all in `lib/answer-copy.ts`,
while the provisions, their headings and the official text stay exactly as printed in English, with
a note on the page saying which is which. Where an explanation is the project's own reading rather
than official text it is labelled `AI-assisted explanation in Hindi/Marathi` — no translated text is
ever presented as the law, and none is machine-generated into the corpus.

## Application routes

| Route | What it does |
| --- | --- |
| `/` | Entry point: the question box, corpus counts, subjects, topics, and the trust summary |
| `/parts`, `/parts/[label]` | Every Part and Schedule with its Articles |
| `/article/[number]` | Simple explanation, official text (per language), page references, keywords, related Articles, sources |
| `/themes`, `/themes/[id]` | Subject-based navigation (equality, privacy, education, …) |
| `/search?q=` | Full-text search; results are grouped into **Constitution** and **Statutes (BNS · BNSS · BSA)** and never blended |
| `/statutes` | The three Sanhitas: counts, verification status, links to sections and schedules |
| `/statutes/[document]` | Sections of BNS/BNSS/BSA, grouped by chapter |
| `/statutes/[document]/[number]` | One section: official text, provisos, illustrations, footnotes, derived explanation, keywords, cross-references, source page, verification notes |
| `/statutes/[document]/schedule/[id]` | A schedule verbatim, plus its printed entries |
| `/schedules` | The twelve Schedules of the Constitution, and the Schedules of the Sanhitas (BNSS First and Second, BSA) with their printed entries |
| `/about` | Sources, method, the two-layer rule, corrections policy |
| `/ask` | **The assistant**: a conversation of structured legal cards, with the example questions, the retrieval trace and the refusal wording |
| `/laws` | Landing page for the three Sanhitas, with counts, Act numbers and subjects that run across them |
| `/constitution` | Landing page for the Constitution: Preamble, Parts, Schedules, explanations |
| `/explore` | The four ways into the database (subject · topic · structure · section number) |
| `/concepts`, `/concepts/[id]` | The 28 subjects and, for each, its Articles and sections marked anchor / title / keyword / text match |
| `/bookmarks` | Provisions saved in the reader's own browser (no account, nothing on the server) |
| `/history` | Questions asked and provisions opened, kept on the device and clearable |
| `/methodology` | How the text is extracted, what “verified” means, how the notes are made, and what the database does not do |
| `/settings` | Language, text size, collapsed navigation, and clearing local data |
| `/status` | Public data-quality dashboard |
| `/api/search?q=` | JSON retrieval endpoint (concepts → hybrid search → full provision rows → rerank) |
| `/api/ask` (GET `?q=`, POST `{q,limit}`) | JSON assistant endpoint: understanding, retrieval trace, cards, sources, follow-ups, `grounded` |
| `/api/explain?kind=&id=` | One provision's structured explanation (404 when it is not held) |

Language is carried in `?lang=hi|mr` (and remembered in a cookie), so any page
can be shared in any language.

The interface is a left rail with a mobile drawer (the same navigation on every
device).  The rail rests **short** — icons only, 68px — so the page keeps its
room; the ☰ button at its head expands it to the full list, and the choice lasts
for the browser tab (`sessionStorage`, `ss.rail`).  It is sticky inside the
layout row, so it holds its position while a page scrolls and does not move
between pages.  Its identity is paper, navy and brass, with the official text
set apart from this project's notes by a bar and a label wherever both appear.

## Safety rails enforced at build time

`npm run data:build` fails loudly (or reports) when:

* a simple explanation is byte-identical to the official text of the same Article,
* an Article in 1–395 is missing, duplicated, or has empty official English text
  without being an omitted Article,
* a “related Article” reference points at an Article that does not exist,
* a keyword is duplicated, or a source URL is missing.

For the statutory corpus the same build checks that every section listed in the
source's arrangement table was extracted, that no derived text is ever stored as
official text, and that every cross-reference points at a provision that exists;
data problems are printed at the end of the build.

Current state — Constitution: **0 problems**, 502 of 503 Articles verified (the
one flagged Article is listed below); statutes: **1,049 of 1,061 sections
verified**, 12 flagged for review for documented structural reasons (BNS 9,
BNSS 2 — including the record whose stored number is inferred from the
arrangement because the body prints the numeral twice — and BSA 1).  The whole
database is therefore 1,551 verified records and 13 flagged, and every flagged
record is named in the validation report and on `/status`.

## Validation report

`pipeline/unified.py` writes `data/unified/validation_report.json`: 27 named
checks with `PASS`, `WARN` or `FAIL`, the affected records, and a list of
*known gaps* stated openly.  Nothing is marked `PASS` unless it actually passed.

Current result: **23 PASS · 4 WARN · 0 FAIL** (the twenty-seventh check,
`citizen_notes`, confirms that all 1,564 provisions carry a “what this means for
you” note).  **PASS WITH WARNINGS.**  The four warnings are the four things this
dataset genuinely cannot yet claim:

| Warning | What it says |
| --- | --- |
| `verification_status` | 1,551 of 1,564 records verified; 13 flagged `needs_review`, each named |
| `act_number_completeness` | the BNSS source is the Bill as introduced and prints no Act number — left empty, not filled from outside the source |
| `official_language_text` | English text for 1,564 provisions; official Hindi 0, official Marathi 0 — the Devanagari editions are legacy-font scans pending per-provision verification |
| `schedule_structure_status` | the schedule *structure* (row/cell splits) is machine-derived and marked `structure_verified: false`; the schedule *text* is verbatim |

None of the four is a failure and none is hidden: each affected record is named
in the report and shown on `/status`.

## Licence and attribution

Official text: Government of India (Legislative Department) and, for the Marathi
edition, the Government of Maharashtra. Editorial explanations, code and data
pipeline: this project. In case of any difference, the text published by the
Government of India prevails.

## Deployment note

This project uses `better-sqlite3`, a native Node module. Do not commit or upload
`node_modules`; let Netlify install dependencies on its Linux build image. Node 20
is pinned by `netlify.toml` and `.nvmrc`. The packaged SQLite database is read-only
at runtime; its WAL is checkpointed during preparation only when a WAL file exists.

If Netlify reports a missing `better-sqlite3` binding, clear the site's build cache
and redeploy so dependencies are installed from `package-lock.json` on the Linux
builder.

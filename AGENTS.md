# Sovereign — AGENTS.md
*Updated: 2026-08-20*

## What this is
An offline geography trivia game covering all 197 sovereign entities. **Shipped —
playable.** A stranger clones the repo, double-clicks `Play Trivia.bat`, and is
answering a question in seconds.

**Goal:** anyone curious about the world can learn every country on it, with nothing
to install and no account. Done = all 197 countries in, each with five true facts, and
a player finishes a round knowing countries they did not know before.
**Stack:** plain HTML/CSS/JS, no dependencies · **Run:** double-click `Play Trivia.bat`

## Rules (always follow)

### The file:// constraint — breaking any of these kills the product
The app is opened by double-clicking `index.html`. There is no server, ever.
- **No `fetch()` / `XMLHttpRequest` of local files** — CORS blocks them on `file://`.
- **No ES modules** — no `import`, no `export`, no `<script type="module">`. Same block.
- **No build step, no bundler, no npm, no framework, no CDN link at runtime.**
- Classic `<script src>` only. Modules talk through `window` globals.
- **Load order is fixed:** `data.js` → `storage.js` → `questions.js` → `app.js`.

### Module boundaries (this is what lets the files be worked on independently)
- `storage.js` → `window.Progress`. No `COUNTRY_DATA`, no `Questions`, no DOM.
- `questions.js` → `window.Questions`. Reads `COUNTRY_DATA` only. No `Progress`, no
  DOM, no `localStorage`, no `Date`.
- `app.js` owns the DOM and passes data between the other two.
- **No function in `Progress` or `Questions` may throw, under any input.** A `file://`
  app has no error console anyone will read.

### Do not regenerate
- `assets/css/fonts.css` — 297KB of base64 fonts. Never edit, never rebuild.
- `assets/js/data.js` — generated. Edit `data/countries.json`, then run
  `python data/build-data-js.py`.
- `data/source/` — raw NotebookLM export and its parser. Do not touch.
- `INTENT.md` — immutable.

### Settled product decisions — do not revisit
- Multiple choice, **exactly 4 options**. Distractors always come from the **same
  region** as the answer.
- Five question types, one per fact: capital · currency · language · population
  (4-country superlative, both polarities) · industry (reverse-ID).
- A round is **10 questions**; no country twice; no type more than 3 times.
- **No timer.** The product must not punish a slow thinker.
- Scheduling unit is the **(country, type) pair** — 981 of them. Leitner level 0-5.
  A right answer is `level + 1` capped at 5; a wrong answer is `level → 0`.
- **Mastery commits on every answer**, never at round end.
- Mastered = every *available* type for that country at level ≥ 3.
- Single player. Light + dark mode. No world map.
- Windows only for now — a deliberate limit, stated in `README.md`.

### Data rules the engine depends on
- `capital` is a display string and may carry commas (`Washington, D.C.`) and
  qualifiers. **Never parse it.** Grade against `accepted_capitals[0]`.
- `population` arrives in three formats (`46.8 Million`, `11,000`, `1.44 Billion`).
  All three must parse to a number.
- **Availability is computed at load, never hardcoded.** South Africa and Zimbabwe
  have open-set language records so `language` is unavailable for them; Palau and
  Tonga share a byte-identical `industries` string so `industry` is unavailable for
  both. Fix the data and the engine picks it up with no code change.

### UI rules (non-negotiable)
- **No emoji as icons anywhere.** Inline SVG from the sprite in `index.html` only.
- Text contrast ≥ 4.5:1, borders ≥ 3:1, verified in **both** themes.
- `--color-accent` is **never** text, never an icon stroke, never a meaningful line
  under 8px. `--color-border` is a decorative hairline and must never appear on a
  control — `--color-border-strong` carries every interactive edge. Both look fine on
  screen while failing; treat them as review checklist items.
- The **two dark-token blocks in `styles.css` must be edited as one unit.** There is
  no build step; the shouting comments above each are the only guard.
- Visible focus rings everywhere. `prefers-reduced-motion: reduce` disables all motion.
- Targets ≥ 44×44px. Press and hover states never shift layout bounds.

### Verifying a change
- Open `index.html?audit=1` and read the console: `Questions.audit()` asserts eight
  invariants over 2000 generated questions. `violations` must be empty.
- Play a full round with the region set to **Oceania** — 14 countries is the binding
  constraint on every same-region draw.
- Check at a real 375×667 viewport, toggle both themes on every screen, and tab
  through with the mouse untouched.

## Files in this project (open only when you need them)
- Why this exists, and its limits → `INTENT.md` *(immutable)*
- For humans / how to run it → `README.md`
- Canonical country data → `data/countries.json`; regenerate with
  `python data/build-data-js.py`

## Known data defects
- **Palau and Tonga** — identical `industries` strings; the `industry` type is
  disabled for both until the data is differentiated.
- **South Africa and Zimbabwe** — open-set `languages` strings, so the `language`
  type is disabled for both. Four of the 197 therefore carry four facts, not five;
  the mastery denominator adapts on its own.
- Fixed 2026-08-20: France's `industries` read `food/bequest`; now `food/beverage`.
  A corrupt token is the *rarest* word in the corpus, so the clue ranker promotes it
  to the front of that country's question every time. Spell-check before you commit
  corpus text.

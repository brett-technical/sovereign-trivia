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
- Six question types: capital · currency · language · population (4-country
  superlative, both polarities) · industry (reverse-ID) · flag (identify the
  country from its flag).
- The **flag question is inverted**: the flag goes in the question card and the
  four options stay country names. That reuses the whole text-option path —
  grading, keyboard, screen reader — instead of forking it for image options.
- A round is **10 questions**; no country twice; no type more than 3 times.
- **No timer.** The product must not punish a slow thinker.
- Scheduling unit is the **(country, type) pair** — 1,178 of them. Leitner level 0-5.
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
- Design system, and why it is what it is → `DESIGN.md`
- Canonical country data → `data/countries.json`; regenerate with
  `python data/build-data-js.py`
- Country → ISO2 flag map → `data/flag-codes.py` (run it to validate the map)
- Third-party asset licences → `LICENSES.md`

### Flags
- 197 circular SVGs in `assets/flags/`, named by ISO 3166-1 alpha-2. The
  country → code map is `data/flag-codes.py`; `iso2` on each corpus record.
- They are **plain files, not base64** — `<img src>` works under `file://`.
- **`FLAG_FAMILIES` in `questions.js` is load-bearing.** Flags that look alike
  cluster inside one region (pan-Slavic, Nordic cross, Gran Colombia, Arab
  Liberation, pan-African, Union-Jack ensigns), and distractors are drawn from
  one region — so same-region selection *causes* the collisions rather than
  preventing them. At most one member of a family may appear per option set.
  A pairwise veto list was tried first and kept missing cases; do not go back
  to one. Adding a country to the corpus means checking it against these
  families.

## Known data defects
- None open as of 2026-08-23. Palau/Tonga industries were identical (type
  disabled); split using CIA Factbook industries after the notebook table
  collapsed them. South Africa / Zimbabwe language strings were open-set
  (`N official … etc.`); closed to named languages from the same notebook.
  France `food/bequest` → `food/beverage` was fixed 2026-08-20.

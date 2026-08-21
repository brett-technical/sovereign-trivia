# DESIGN.md — Sovereign

A plain-text design system, in the Stitch `DESIGN.md` shape, so an agent can
extend this UI without re-deriving it. `assets/css/styles.css` is the
implementation and wins any disagreement; this file explains *why*.

## Visual theme

**Vibrant & block-based.** Bold, high-contrast blocks with hard offset shadows
and generous spacing. The mood is a confident quiz show, not a worksheet — it
should feel good to be wrong in.

Guardrails, in priority order:
1. Legibility beats decoration. Nothing tinted, blurred, or animated may cost a
   contrast ratio.
2. Colour is never the only carrier of meaning. Every correct/wrong state also
   has an icon and a word.
3. Weight is a feature. This ships offline with no install; an asset must earn
   its bytes.

## Colour

Semantic tokens only — never a raw hex in a component rule.

| Token | Light | Role |
|---|---|---|
| `--color-primary` | `#2563EB` | Focus rings, active chips, meter fill |
| `--color-accent` | `#F59E0B` | The single call to action, and the streak pill |
| `--color-background` | `#EFF6FF` | Page ground |
| `--color-foreground` | `#0F172A` | Body text |
| `--color-card` | `#FFFFFF` | Raised surfaces |
| `--color-border` | `#E4ECFC` | Block edges and flag rings |
| `--color-success` | `#15803D` | Correct |
| `--color-destructive` | `#DC2626` | Wrong |

Dark mode is a **separate, deliberate palette**, not an inversion, and every
pair is re-checked there. Two rules that are easy to break:

- A colour must never have its only definition inside a media query, or the
  in-app toggle cannot override the OS setting. Define on `:root`, then
  override under both `prefers-color-scheme` and `[data-theme]`.
- Borders must stay visible in **both** themes. A border that dissolves in dark
  mode takes the block structure with it.

Text ≥ 4.5:1. Borders, icons, and other non-text ≥ 3:1.

### Continent colour

Each region owns a hue (`--region-africa` … `--region-oceania`), defined for
both themes. The quiz screen carries `data-region` and washes itself in that
hue at ~16% via `color-mix`, which also tints the card border and progress
meter. The wash sits far below any text, so no contrast pair moves. Browsers
without `color-mix` get the flat token through an `@supports not` fallback.

## Typography

- **Display — Baloo 2** (400/600/700): headings, question text, country names,
  numerals, UI chrome.
- **Body — Comic Neue** (400/700): answer labels, revealed facts, prose.

Both are base64-embedded (`assets/css/fonts.css`) under the OFL so the game
works with no network. Body text never below 16px; line-height 1.5.

## Motion

`--dur-state: 200ms`, `--ease-standard: cubic-bezier(.2, 0, 0, 1)`. Motion
conveys state change, never decoration. Press states use colour and shadow and
must **not** shift layout bounds. Everything is disabled under
`prefers-reduced-motion: reduce`.

## Components

- **Answer option** — a real `<button>`, ≥44px, with a decorative number badge
  and `aria-keyshortcuts`. Six states: default, hover, focus, selected,
  correct, wrong. Correct and wrong carry an icon plus visually-hidden text, so
  a screen reader hears the result rather than only seeing a colour.
- **Question card** — type label, question text, and an optional media slot.
  The flag question puts a circular flag here; other types leave it empty.
- **Flag** — circular SVG with a 2–3px ring in `--color-border`, never a hard
  border (that reads as a coin). Width and height are set in the markup so the
  space is reserved and layout shift stays at zero. Greyscaled on the progress
  screen while a country is unmastered — alongside a word, never colour alone.
- **Streak pill** — accent-coloured, appears only from three correct in a row
  so it reads as an event. Not a live region; the answer is already announced.

## Layout

Mobile-first. Breakpoints 375 / 768 / 1024 / 1440. Spacing on a 4/8px rhythm,
vertical tiers 16/24/32/48.

Two hard-won layout rules:
- **No `position: sticky` action bar.** A sticky element as the last child
  paints over whatever is at the foot of the viewport at every scroll offset
  above its rest position — it covered the fourth answer option entirely at
  375px and trapped keyboard focus. The bar stays in flow at every width.
- Long country names and industry strings must wrap without clipping. Check
  against the longest strings actually in the corpus, not a guess.

## Anti-patterns

- Emoji as icons. Use inline SVG. On Windows this is not merely a style rule:
  Segoe UI Emoji has **no country flag glyphs**, so flag emoji render as bare
  letter pairs (`JP`, `US`).
- Raw hex in a component rule.
- `outline: none` without a visible replacement.
- One duration reused for every transition.
- Any runtime network reference. It breaks the offline promise silently.

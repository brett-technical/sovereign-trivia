# Country flags

197 circular SVG flags, one per sovereign entity in the corpus, named by
ISO 3166-1 alpha-2 code (`data/flag-codes.py` holds the country → code map).

**Source:** [HatScripts/circle-flags](https://github.com/HatScripts/circle-flags) — MIT licence.

They ship as plain `.svg` files rather than base64 because `<img src>` works
under the `file://` protocol; only `fetch` and ES modules are blocked. The whole
set is ~116 KB.

Kosovo uses the user-assigned code `xk`, which is what the upstream project
ships it under.

## Why this set and not `flag-icons`

`lipis/flag-icons` renders coats of arms as full vector paths — Mexico alone is
84,753 bytes there against 1,687 here, and the complete set would run past 1.5 MB.
`circle-flags` simplifies the emblems and keeps the whole world under 120 KB,
which is what a no-install, offline game can afford.

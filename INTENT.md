---
subject: Trivia Game — Countries of the World
set: 2026-08-20
---

# Intent — Trivia Game

## Purpose

So anyone curious about the world can learn every country on it — all of them, not the
famous two dozen — and can start playing within a minute of finding the repo. Interest
is never the barrier; setup is.

## Key tasks

- Every country covered, no gaps. A world map with holes teaches holes.
- Facts are true and traceable to their source. Wrong trivia is worse than none.
- A stranger goes from `git clone` to a question on screen with nothing to install
  and no account.
- It runs on their machine, not just yours.
- The repo explains itself. Nobody has to ask you how to start it.

## End state

- All 197 entries in — the 193 UN members plus Holy See, Palestine, Taiwan and
  Kosovo — each with its five facts, none placeholder.
- Someone who has never seen it reaches a question without asking you anything.
- It runs on a clean Windows machine that has nothing set up.
- A player finishes a round knowing countries they did not know before.

## Limits

- No server, no hosting, no accounts, no cloud. If it needs something running
  somewhere else, it is the wrong build.
- Windows only for now. Mac is a later decision, not a quiet omission — the README
  says so.
- Nothing heavy. No build step, no framework weight, no install a stranger sits
  through. Lightweight beats capable.
- Countries only. No other trivia categories until all 197 are complete and correct.

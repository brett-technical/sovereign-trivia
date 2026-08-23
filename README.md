# Sovereign

A geography trivia game covering **all 197 sovereign entities** — the 193 UN members
plus the Holy See, Palestine, Taiwan and Kosovo. Not the famous two dozen. All of them.

Five facts plus the flag, asked six ways: capital city, currency, main language,
population, the industries an economy runs on, and which country a flag belongs to. The four choices always come from
the same region, so they are genuinely hard. After you answer, you see every fact for
that country — which is the point.

Your progress is saved in your browser. Countries you miss come back sooner.

## Get it

**Option 1:** Download the ZIP and unzip it — no git required:

https://github.com/brett-technical/sovereign-trivia/archive/refs/heads/main.zip

**Option 2:** Clone and stay up to date:

```bash
git clone https://github.com/brett-technical/sovereign-trivia.git
```

Then double-click `Play Trivia.bat`.

## How to run it

Double-click **`Play Trivia.bat`**.

That's it. It opens in your normal browser and you're playing.

If you'd rather not use the launcher, double-click `index.html` instead. Same thing.

**No install. No internet. No account. No sign-up.** Nothing runs in the background
and nothing leaves your machine.

## Windows only, for now

The launcher is a Windows `.bat` file. On macOS or Linux you can still play by opening
`index.html` in a browser — everything works — there just isn't a double-click
launcher yet. That's a decision we haven't made, not something we forgot.

## What's in it

197 countries, each with five facts plus its flag:

| Fact | Example |
|---|---|
| Capital | Nairobi |
| Languages | Swahili, English |
| Currency | Kenyan Shilling (KES) |
| Population | 55.1 Million |
| Industries | Agriculture, tourism, … |
| Flag | (shown on every reveal, and asked directly) |

The data was compiled with NotebookLM from public country references, then checked and
cleaned by hand. The raw export and the parser that turned it into structured data are
in `data/source/`.

If you spot something wrong, the file to fix is `data/countries.json`.

## Regenerating the data

`assets/js/data.js` is generated from `data/countries.json` — never edit it directly.
After changing the JSON, run:

```
python data/build-data-js.py
```

Python 3 is the only thing this needs, and only for that one step. Playing the game
needs nothing at all.

## Browsers

Tested on current Chrome, Edge and Firefox. If your browser blocks local storage
(a private window, for example) the game still plays — it just won't remember your
progress, and it tells you so.

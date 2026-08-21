/* Sovereign — progress store.
 *
 * Dependencies: none. Must never read COUNTRY_DATA or Questions, and must never
 * touch the DOM. Every localStorage access is guarded: on file:// the origin is
 * opaque and storage can be absent, blocked, or full. The game runs fully in
 * memory when that happens; nothing here may throw.
 */
(function () {
  'use strict';

  var VERSION = 1;
  var KEY = 'sovereign.v1';
  var RECENT_MAX = 6;
  var SLOT_COUNT = 4;
  var LEVEL_MAX = 5;
  var REGIONS = ['all', 'Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];

  var state = freshState();
  var persistent = true;

  /* ---------- shape helpers ---------- */

  function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  // Rejects anything that is not a finite number, or that falls below `min`.
  function toInt(value, fallback, min) {
    if (typeof value !== 'number' || !isFinite(value)) return fallback;
    var i = Math.trunc(value);
    return i < min ? fallback : i;
  }

  function toNum(value, fallback, min) {
    if (typeof value !== 'number' || !isFinite(value)) return fallback;
    return value < min ? fallback : value;
  }

  function freshState() {
    return {
      v: VERSION,
      questionIndex: 0,
      recent: [],
      slots: [0, 0, 0, 0],
      pairs: {},
      totals: { rounds: 0, asked: 0, correct: 0 },
      best: { score: -1, total: 0 },
      theme: null,
      region: 'all'
    };
  }

  function copyPair(p) {
    return { n: p.n, c: p.c, l: p.l, ai: p.ai, wi: p.wi };
  }

  function pairKey(countryKey, type) {
    return String(countryKey) + '|' + String(type);
  }

  /* Turns an untrusted parsed blob into a valid state, or null when it cannot
   * be used at all (wrong type, wrong version). Every field is validated on its
   * own, so a payload that is half-corrupt keeps the half that survives. */
  function normalise(raw) {
    if (!isPlainObject(raw)) return null;
    if (raw.v !== VERSION) return null;

    var s = freshState();
    var i;

    s.questionIndex = toInt(raw.questionIndex, 0, 0);

    if (Array.isArray(raw.recent)) {
      s.recent = raw.recent
        .filter(function (k) { return typeof k === 'string' && k !== ''; })
        .slice(-RECENT_MAX);
    }

    if (Array.isArray(raw.slots)) {
      for (i = 0; i < SLOT_COUNT; i++) s.slots[i] = toNum(raw.slots[i], 0, 0);
    }

    if (isPlainObject(raw.pairs)) {
      Object.keys(raw.pairs).forEach(function (k) {
        var p = raw.pairs[k];
        if (!k || !isPlainObject(p)) return;
        s.pairs[k] = {
          n: toInt(p.n, 0, 0),
          c: toInt(p.c, 0, 0),
          l: Math.min(LEVEL_MAX, toInt(p.l, 0, 0)),
          ai: toInt(p.ai, -1, -1),
          wi: toInt(p.wi, -1, -1)
        };
      });
    }

    if (isPlainObject(raw.totals)) {
      s.totals.rounds = toInt(raw.totals.rounds, 0, 0);
      s.totals.asked = toInt(raw.totals.asked, 0, 0);
      s.totals.correct = toInt(raw.totals.correct, 0, 0);
    }

    if (isPlainObject(raw.best)) {
      s.best.score = toInt(raw.best.score, -1, -1);
      s.best.total = toInt(raw.best.total, 0, 0);
    }

    s.theme = (raw.theme === 'light' || raw.theme === 'dark') ? raw.theme : null;
    s.region = REGIONS.indexOf(raw.region) >= 0 ? raw.region : 'all';

    return s;
  }

  /* ---------- persistence ---------- */

  function persist() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
      persistent = true;
    } catch (e) {
      persistent = false;
    }
  }

  function load() {
    var raw = null;
    try {
      raw = window.localStorage.getItem(KEY);
    } catch (e) {
      // Storage is unavailable, not merely empty. Say so, and play in memory.
      persistent = false;
    }

    var parsed = null;
    if (typeof raw === 'string' && raw !== '') {
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        parsed = null;
      }
    }

    state = normalise(parsed) || freshState();

    /* Probe the write, do not assume it from the read. Quota-full storage and
     * private-browsing modes both read fine and throw on write; without this
     * the "progress will not be saved" notice would stay hidden all session
     * while nothing was in fact being saved. persist() sets the flag either way. */
    persist();
  }

  /* ---------- public surface ---------- */

  function snapshot() {
    var out = {
      v: VERSION,
      questionIndex: state.questionIndex,
      recent: state.recent.slice(),
      slots: state.slots.slice(),
      pairs: {},
      totals: {
        rounds: state.totals.rounds,
        asked: state.totals.asked,
        correct: state.totals.correct
      },
      best: { score: state.best.score, total: state.best.total },
      theme: state.theme,
      region: state.region
    };
    Object.keys(state.pairs).forEach(function (k) {
      out.pairs[k] = copyPair(state.pairs[k]);
    });
    return out;
  }

  function getPair(countryKey, type) {
    var p = state.pairs[pairKey(countryKey, type)];
    return p ? copyPair(p) : null;
  }

  function record(countryKey, type, wasCorrect, slotIndex) {
    var key = pairKey(countryKey, type);
    var i;

    state.questionIndex += 1;

    var p = state.pairs[key];
    if (!p) {
      p = { n: 0, c: 0, l: 0, ai: -1, wi: -1 };
      state.pairs[key] = p;
    }

    p.n += 1;
    if (wasCorrect) {
      p.c += 1;
      p.l = Math.min(LEVEL_MAX, p.l + 1);
    } else {
      p.l = 0;
      p.wi = state.questionIndex;
    }
    p.ai = state.questionIndex;

    state.recent.push(String(countryKey));
    while (state.recent.length > RECENT_MAX) state.recent.shift();

    if (typeof slotIndex === 'number' && slotIndex >= 0 && slotIndex < SLOT_COUNT &&
        Math.trunc(slotIndex) === slotIndex) {
      for (i = 0; i < SLOT_COUNT; i++) state.slots[i] = state.slots[i] * 0.9;
      state.slots[slotIndex] += 1;
    }

    state.totals.asked += 1;
    if (wasCorrect) state.totals.correct += 1;

    persist();
  }

  function finishRound(correctCount, total) {
    var score = toInt(correctCount, 0, 0);
    var outOf = toInt(total, 0, 0);

    state.totals.rounds += 1;
    if (score > state.best.score) {
      state.best = { score: score, total: outOf };
    }
    persist();
  }

  function totals() {
    return {
      rounds: state.totals.rounds,
      asked: state.totals.asked,
      correct: state.totals.correct,
      bestScore: state.best.score,
      bestTotal: state.best.total
    };
  }

  function getTheme() {
    return state.theme;
  }

  function setTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') return;
    state.theme = theme;
    persist();
  }

  function getRegion() {
    return state.region;
  }

  function setRegion(region) {
    if (REGIONS.indexOf(region) < 0) return;
    state.region = region;
    persist();
  }

  function reset() {
    var theme = state.theme;
    var region = state.region;
    state = freshState();
    state.theme = theme;
    state.region = region;
    persist();
  }

  window.Progress = {
    VERSION: VERSION,
    KEY: KEY,
    load: load,
    isPersistent: function () { return persistent; },
    snapshot: snapshot,
    getPair: getPair,
    record: record,
    finishRound: finishRound,
    totals: totals,
    getTheme: getTheme,
    setTheme: setTheme,
    getRegion: getRegion,
    setRegion: setRegion,
    reset: reset
  };
})();

/* Sovereign — application shell.
 *
 * Owns the DOM, the four-screen state machine, and every keyboard handler.
 * Calls Progress and Questions; those two never call each other and never
 * call back into here. Boots on DOMContentLoaded.
 *
 * The two phase guards in answer() and advance() are load-bearing: they, not
 * the `disabled` attribute, are what stop a double-click double-scoring and a
 * held Enter skipping a question.
 */
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var ROUND_SIZE = 10;
  var BAND_WORDS = { 'new': 'New', seen: 'Seen', familiar: 'Familiar', mastered: 'Mastered' };
  var BAND_ORDER = ['mastered', 'familiar', 'seen', 'new'];

  /* ---------------------------------------------------------------- *
   * Elements
   * ---------------------------------------------------------------- */

  function el(id) { return document.getElementById(id); }

  var main, live, notice, screens;
  var btnPlay, btnProgress, btnTheme, chipBox, statSeen, statMastered, statBest;
  var btnQuit, meter, countEl, scoreEl, qType, qText, optionsBox;
  var revealBox, banner, revealIcon, verdict, revealCountry, factsEl, noteEl, btnNext;
  var qFlag, revealFlag, streakEl, quizScreen, btnResetHome;
  var streak = 0;

  /* country name -> ISO2, for flag filenames. Built from the same corpus the
   * engine reads, so it cannot drift from it. */
  var FLAG_OF = (function () {
    var map = {};
    var rows = window.COUNTRY_DATA || [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i].country && rows[i].iso2) map[rows[i].country] = rows[i].iso2;
    }
    return map;
  })();
  var summaryScore, summaryLine, summaryReview, btnAgain, btnSummaryProgress, btnSummaryHome;
  var progHeadline, progSub, progSegbar, regionsBox, progTitle;
  var btnProgressHome, btnReset, dialog, btnResetCancel, btnResetConfirm;

  function grab() {
    main = el('main');
    live = el('live');
    notice = el('notice');
    screens = {
      home: el('screen-home'),
      quiz: el('screen-quiz'),
      summary: el('screen-summary'),
      progress: el('screen-progress')
    };

    btnPlay = el('btn-play');
    btnProgress = el('btn-progress');
    btnTheme = el('btn-theme');
    chipBox = el('region-chips');
    statSeen = el('stat-seen');
    statMastered = el('stat-mastered');
    statBest = el('stat-best');

    btnQuit = el('btn-quit');
    meter = el('round-meter');
    countEl = el('round-count');
    scoreEl = el('round-score');
    qType = el('question-type');
    qText = el('question-text');
    optionsBox = el('options');

    revealBox = el('reveal');
    banner = el('reveal-banner');
    revealIcon = el('reveal-icon');
    verdict = el('reveal-verdict');
    revealCountry = el('reveal-country');
    factsEl = el('reveal-facts');
    noteEl = el('reveal-note');
    qFlag = el('question-flag');
    revealFlag = el('reveal-flag');
    streakEl = el('round-streak');
    quizScreen = el('screen-quiz');
    btnResetHome = el('btn-reset-home');
    btnNext = el('btn-next');

    summaryScore = el('summary-score');
    summaryLine = el('summary-line');
    summaryReview = el('summary-review');
    btnAgain = el('btn-again');
    btnSummaryProgress = el('btn-summary-progress');
    btnSummaryHome = el('btn-summary-home');

    progHeadline = el('progress-headline');
    progSub = el('progress-sub');
    progSegbar = el('progress-segbar');
    regionsBox = el('progress-regions');
    progTitle = screens.progress.querySelector('.screen__title');

    btnProgressHome = el('btn-progress-home');
    btnReset = el('btn-reset');
    dialog = el('dialog-reset');
    btnResetCancel = el('btn-reset-cancel');
    btnResetConfirm = el('btn-reset-confirm');
  }

  /* ---------------------------------------------------------------- *
   * State
   * ---------------------------------------------------------------- */

  var screenName = 'home';
  var phase = 'question';
  var round = null;
  var theme = 'light';
  var expanded = {};   // region name -> true while its panel is open

  /* ---------------------------------------------------------------- *
   * Small DOM helpers
   * ---------------------------------------------------------------- */

  function setUse(svg, symbol) {
    if (!svg) return;
    var use = svg.querySelector('use');
    if (use) use.setAttribute('href', '#' + symbol);
  }

  function iconNode(symbol, cls) {
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', cls);
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS(SVGNS, 'use');
    use.setAttribute('href', '#' + symbol);
    svg.appendChild(use);
    return svg;
  }

  function span(cls, text) {
    var s = document.createElement('span');
    s.className = cls;
    if (text !== undefined) s.textContent = text;
    return s;
  }

  function decorative(cls, text) {
    var s = span(cls, text);
    s.setAttribute('aria-hidden', 'true');
    return s;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  /* ---------------------------------------------------------------- *
   * Derived values — app.js owns these; no other module does
   * ---------------------------------------------------------------- */

  /* One pass over the corpus and the snapshot. Returns per-country bands plus
   * the three headline numbers. Mastery is "every available pair at level >= 3",
   * so the denominator is Questions.availableTypes(), never a hardcoded 5. */
  function computeStats() {
    var snap = Progress.snapshot();
    var pairs = snap.pairs || {};
    var all = Questions.countriesIn('all');
    var perCountry = {};
    var seen = 0;
    var mastered = 0;
    var learned = 0;

    all.forEach(function (country) {
      var types = Questions.availableTypes(country);
      var dots = [];
      var learnedHere = 0;
      var seenHere = 0;

      types.forEach(function (type) {
        var p = pairs[country + '|' + type];
        var on = !!p && p.l >= 3;
        if (on) { learnedHere += 1; learned += 1; }
        if (p && p.n > 0) seenHere += 1;
        dots.push(on);
      });

      var band;
      if (seenHere === 0) band = 'new';
      else if (types.length > 0 && learnedHere === types.length) band = 'mastered';
      else if (types.length > 0 && learnedHere / types.length >= 0.5) band = 'familiar';
      else band = 'seen';

      if (seenHere > 0) seen += 1;
      if (band === 'mastered') mastered += 1;
      perCountry[country] = { dots: dots, band: band };
    });

    return { perCountry: perCountry, seen: seen, mastered: mastered, learned: learned };
  }

  /* Countries with at least one answered pair, read straight off a snapshot. */
  function seenCountries(snap) {
    var out = {};
    var pairs = (snap && snap.pairs) || {};
    Object.keys(pairs).forEach(function (k) {
      var p = pairs[k];
      var cut = k.lastIndexOf('|');
      if (p && p.n > 0 && cut > 0) out[k.slice(0, cut)] = true;
    });
    return out;
  }

  function bandCounts(countries, perCountry) {
    var c = { mastered: 0, familiar: 0, seen: 0, 'new': 0 };
    countries.forEach(function (name) {
      var rec = perCountry[name];
      c[rec ? rec.band : 'new'] += 1;
    });
    return c;
  }

  function fillSegbar(bar, counts, total) {
    var segs = bar.children;
    for (var i = 0; i < BAND_ORDER.length && i < segs.length; i++) {
      var pct = total > 0 ? (counts[BAND_ORDER[i]] / total) * 100 : 0;
      segs[i].style.width = pct + '%';
    }
  }

  /* ---------------------------------------------------------------- *
   * Screens
   * ---------------------------------------------------------------- */

  function show(name) {
    Object.keys(screens).forEach(function (k) {
      screens[k].hidden = (k !== name);
    });
    screenName = name;
  }

  function goHome() {
    round = null;
    renderHome();
    show('home');
    btnPlay.focus();
  }

  function renderHome() {
    var st = computeStats();
    var t = Progress.totals();
    statSeen.textContent = String(st.seen);
    statMastered.textContent = String(st.mastered);
    statBest.textContent = t.bestScore >= 0 ? (t.bestScore + ' / ' + t.bestTotal) : '—';
    syncChips();
  }

  function syncChips() {
    var active = Progress.getRegion();
    var chips = chipBox.querySelectorAll('.chip');
    for (var i = 0; i < chips.length; i++) {
      var on = chips[i].getAttribute('data-region') === active;
      chips[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  /* ---------------------------------------------------------------- *
   * Quiz
   * ---------------------------------------------------------------- */

  function setMeter(done, total) {
    meter.style.setProperty('--p', total > 0 ? String(done / total) : '0');
    meter.setAttribute('aria-valuenow', String(done));
    meter.setAttribute('aria-valuemax', String(total));
  }

  function startRound() {
    var snap = Progress.snapshot();
    var already = seenCountries(snap);
    var qs = Questions.buildRound(snap, { count: ROUND_SIZE, region: Progress.getRegion() });

    if (!qs.length) {
      live.textContent = 'No round could be built for that region.';
      return;
    }

    var fresh = 0;
    qs.forEach(function (q) { if (!already[q.countryKey]) fresh += 1; });

    round = { qs: qs, at: 0, correct: 0, results: [], fresh: fresh, bestStreak: 0 };
    streak = 0;
    paintStreak();
    show('quiz');
    renderQuestion();
  }

  function optionNode(label, index) {
    var b = document.createElement('button');
    b.className = 'opt';
    b.type = 'button';
    b.setAttribute('data-index', String(index));
    /* The number badge is decoration; this is how the shortcut is announced. */
    b.setAttribute('aria-keyshortcuts', String(index + 1));
    b.appendChild(decorative('opt__key', String(index + 1)));
    b.appendChild(span('opt__label', label));
    b.appendChild(iconNode('i-check', 'icon opt__mark'));
    return b;
  }

  /* Relative path so it resolves the same from file:// and from a server.
   * An <img> is fine under file:// — only fetch and modules are blocked. */
  function flagSrc(code) { return 'assets/flags/' + code + '.svg'; }

  function setFlag(img, code, label) {
    if (!code) { img.hidden = true; img.removeAttribute('src'); img.alt = ''; return; }
    img.src = flagSrc(code);
    /* Decorative when the country is already named beside it; described when
     * the flag itself is the question. */
    img.alt = label || '';
    img.hidden = false;
  }

  function paintStreak() {
    if (streak < 3) { streakEl.hidden = true; streakEl.textContent = ''; return; }
    streakEl.textContent = streak + ' in a row';
    streakEl.hidden = false;
  }

  function renderQuestion() {
    phase = 'question';
    var q = round.qs[round.at];

    qType.textContent = Questions.TYPE_LABELS[q.type] || q.type;
    qText.textContent = q.prompt;

    /* Continent identity: CSS reads this to tint the screen using the
     * --region-* tokens that already exist. */
    quizScreen.setAttribute('data-region', q.region || 'All');

    if (q.media && q.media.kind === 'flag') {
      /* The flag IS the question, so it carries a real description rather
       * than naming the country the player is being asked to identify. */
      setFlag(qFlag, q.media.code, 'The flag to identify');
    } else {
      setFlag(qFlag, null);
    }

    /* Rebuilt, not reused: a stale option node is detached, so a click that
     * arrives late (held Enter, slow double-click) cannot reach the handler. */
    clear(optionsBox);
    q.options.forEach(function (label, i) {
      optionsBox.appendChild(optionNode(label, i));
    });

    revealBox.hidden = true;
    revealBox.removeAttribute('data-result');
    banner.removeAttribute('data-result');
    noteEl.hidden = true;
    btnNext.hidden = true;

    setMeter(round.at, round.qs.length);
    countEl.textContent = (round.at + 1) + ' / ' + round.qs.length;
    scoreEl.textContent = String(round.correct);

    if (optionsBox.firstElementChild) optionsBox.firstElementChild.focus();
  }

  function paintOptions(chosen, answerIndex) {
    var nodes = optionsBox.children;
    for (var i = 0; i < nodes.length; i++) {
      var b = nodes[i];
      /* aria-disabled, never `disabled`: all four stay tabbable so a screen
       * reader user can walk back over them and read which was right. */
      b.setAttribute('aria-disabled', 'true');
      if (i === chosen) b.setAttribute('data-selected', '');
      if (i === answerIndex) {
        b.setAttribute('data-result', 'correct');
        setUse(b.querySelector('.opt__mark'), 'i-check');
      } else if (i === chosen) {
        b.setAttribute('data-result', 'wrong');
        setUse(b.querySelector('.opt__mark'), 'i-x');
      }
      /* Fill and glyph are both decoration to a screen reader. Without these
       * words all four options read identically after an answer. */
      var said = (i === answerIndex)
        ? (i === chosen ? 'Your answer. Correct.' : 'Correct answer.')
        : (i === chosen ? 'Your answer. Wrong.' : '');
      if (said) b.appendChild(span('visually-hidden', said));
    }
  }

  function buildReveal(q, ok) {
    var r = q.reveal;
    var word = ok ? 'correct' : 'wrong';

    revealBox.setAttribute('data-result', word);
    banner.setAttribute('data-result', word);
    setUse(revealIcon, ok ? 'i-check' : 'i-x');
    verdict.textContent = ok ? 'Correct' : 'Not quite';
    revealCountry.textContent = r.country;
    /* Named right beside it, so the flag is decorative here. */
    setFlag(revealFlag, r.flag, '');

    clear(factsEl);
    r.facts.forEach(function (f) {
      var row = document.createElement('div');
      row.className = 'fact';
      row.setAttribute('data-key', f.key);
      if (f.key === r.askedKey) row.setAttribute('data-asked', 'true');

      var dt = document.createElement('dt');
      dt.className = 'fact__label';
      dt.textContent = f.label;

      var dd = document.createElement('dd');
      dd.className = 'fact__value';
      dd.textContent = f.value;

      row.appendChild(dt);
      row.appendChild(dd);
      factsEl.appendChild(row);
    });

    if (r.note) {
      noteEl.textContent = r.note;
      noteEl.hidden = false;
    } else {
      noteEl.textContent = '';
      noteEl.hidden = true;
    }

    revealBox.hidden = false;
  }

  function answer(index) {
    if (screenName !== 'quiz' || phase !== 'question' || !round) return;

    var q = round.qs[round.at];
    var g = Questions.grade(q, index);

    /* Mastery commits here, per answer — never at round end. A file:// app
     * gets closed abruptly and nothing already earned may be lost. */
    Progress.record(q.countryKey, q.type, g.correct, q.answerIndex);
    /* Storage can start refusing writes mid-session once it fills. boot()'s
     * check cannot see that, and this is the moment it starts costing. */
    if (notice.hidden && !Progress.isPersistent()) notice.hidden = false;

    phase = 'reveal';
    if (g.correct) round.correct += 1;
    streak = g.correct ? streak + 1 : 0;
    if (streak > round.bestStreak) round.bestStreak = streak;
    round.results.push({ q: q, correct: g.correct });

    paintOptions(index, g.answerIndex);
    buildReveal(q, g.correct);
    paintStreak();
    scoreEl.textContent = String(round.correct);
    setMeter(round.at + 1, round.qs.length);

    /* Text first, focus second. A focus change before the text is set
     * truncates the announcement. */
    live.textContent = (g.correct ? 'Correct. ' : 'Not quite. ') + q.reveal.sentence;
    btnNext.hidden = false;
    btnNext.focus();
  }

  function advance() {
    if (screenName !== 'quiz' || phase !== 'reveal' || !round) return;

    if (round.at < round.qs.length - 1) {
      round.at += 1;               // the only place this is incremented
      renderQuestion();
      return;
    }
    Progress.finishRound(round.correct, round.qs.length);
    renderSummary();
  }

  /* ---------------------------------------------------------------- *
   * Summary
   * ---------------------------------------------------------------- */

  function answerText(q) {
    var r = q.reveal;
    if (r.headline !== r.country) return r.headline;
    /* population and industry are attributed to the country itself, so the
     * headline would just repeat .review__country. Show the fact instead. */
    for (var i = 0; i < r.facts.length; i++) {
      if (r.facts[i].key === r.askedKey) return r.facts[i].value;
    }
    return r.headline;
  }

  function reviewRow(result) {
    var q = result.q;
    var li = document.createElement('li');
    li.className = 'review__row';
    li.setAttribute('data-result', result.correct ? 'correct' : 'wrong');
    /* First child, so the verdict is read before the country. The glyph beside
     * it is aria-hidden and carries nothing. */
    li.appendChild(span('visually-hidden', result.correct ? 'Correct.' : 'Missed.'));
    li.appendChild(iconNode(result.correct ? 'i-check' : 'i-x', 'icon review__mark'));
    li.appendChild(span('review__country', q.reveal.country));
    li.appendChild(span('review__type', Questions.TYPE_LABELS[q.type] || q.type));
    li.appendChild(span('review__answer', answerText(q)));
    return li;
  }

  function renderSummary() {
    var total = round.qs.length;
    summaryScore.textContent = round.correct + ' / ' + total;
    summaryLine.textContent =
      'You saw ' + total + (total === 1 ? ' country. ' : ' countries. ') +
      round.fresh + (round.fresh === 1 ? ' was new to you.' : ' were new to you.');

    clear(summaryReview);
    round.results.forEach(function (r) { summaryReview.appendChild(reviewRow(r)); });

    show('summary');
    summaryScore.focus();
  }

  /* ---------------------------------------------------------------- *
   * Progress screen
   * ---------------------------------------------------------------- */

  function segbarNode() {
    var bar = document.createElement('div');
    bar.className = 'segbar';
    bar.setAttribute('aria-hidden', 'true');
    BAND_ORDER.forEach(function (b) {
      bar.appendChild(span('segbar__seg segbar__seg--' + b));
    });
    return bar;
  }

  function countryNode(name, rec) {
    var li = document.createElement('li');
    li.className = 'country';
    li.setAttribute('data-band', rec.band);

    var iso = FLAG_OF[name];
    if (iso) {
      var img = document.createElement('img');
      img.className = 'country__flag';
      img.src = flagSrc(iso);
      img.alt = '';               /* the name is right beside it */
      img.width = 28; img.height = 28;
      img.loading = 'lazy';       /* 197 at once otherwise */
      img.decoding = 'async';
      li.appendChild(img);
    }
    li.appendChild(span('country__name', name));

    var dots = decorative('dots');
    rec.dots.forEach(function (on) {
      dots.appendChild(span(on ? 'dot is-on' : 'dot'));
    });
    li.appendChild(dots);

    /* The word, not only the colour, carries the band. */
    li.appendChild(span('country__band', BAND_WORDS[rec.band]));
    return li;
  }

  function regionNode(region, st) {
    var countries = Questions.countriesIn(region);
    var counts = bandCounts(countries, st.perCountry);
    var bodyId = 'region-body-' + region;
    var open = expanded[region] === true;

    var sec = document.createElement('section');
    sec.className = 'region';
    sec.setAttribute('data-region', region);

    var head = document.createElement('button');
    head.className = 'region__head';
    head.type = 'button';
    head.setAttribute('aria-expanded', open ? 'true' : 'false');
    head.setAttribute('aria-controls', bodyId);
    head.setAttribute('data-region-head', region);
    head.appendChild(decorative('region__swatch'));
    head.appendChild(span('region__name', region));
    head.appendChild(span('region__count',
      counts.mastered + ' / ' + countries.length + ' mastered'));
    head.appendChild(iconNode('i-chev', 'icon region__chev'));
    sec.appendChild(head);

    var bar = segbarNode();
    fillSegbar(bar, counts, countries.length);
    sec.appendChild(bar);

    var body = document.createElement('div');
    body.className = 'region__body';
    body.id = bodyId;
    body.hidden = !open;

    var list = document.createElement('ul');
    list.className = 'countries';
    countries.forEach(function (name) {
      list.appendChild(countryNode(name, st.perCountry[name] || { dots: [], band: 'new' }));
    });
    body.appendChild(list);
    sec.appendChild(body);

    return sec;
  }

  function renderProgress() {
    var st = computeStats();
    var all = Questions.countriesIn('all');
    var totalPairs = Questions.totalPairs('all');

    progHeadline.textContent = st.mastered + ' of ' + all.length + ' countries mastered';
    progSub.textContent = st.learned + ' of ' + totalPairs + ' facts learned';
    fillSegbar(progSegbar, bandCounts(all, st.perCountry), all.length);

    clear(regionsBox);
    Questions.REGIONS.forEach(function (r) {
      regionsBox.appendChild(regionNode(r, st));
    });
  }

  function goProgress() {
    renderProgress();
    show('progress');
    progTitle.focus();
  }

  /* ---------------------------------------------------------------- *
   * Theme
   * ---------------------------------------------------------------- */

  function applyTheme(next) {
    theme = next;
    document.documentElement.setAttribute('data-theme', next);
    var offersDark = next === 'light';
    setUse(btnTheme.querySelector('.icon'), offersDark ? 'i-moon' : 'i-sun');
    btnTheme.setAttribute('aria-label',
      offersDark ? 'Switch to dark theme' : 'Switch to light theme');
  }

  /* ---------------------------------------------------------------- *
   * Keyboard
   * ---------------------------------------------------------------- */

  function isArrow(key) {
    return key === 'ArrowUp' || key === 'ArrowDown' ||
           key === 'ArrowLeft' || key === 'ArrowRight';
  }

  function onKeydown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    /* Auto-repeat is dropped, and its default action with it. Held Enter
     * otherwise advances the reveal and then activates the option that
     * renderQuestion has just focused, answering a question nobody saw.
     * Arrows are the browser's own scrolling and are left alone. */
    if (e.repeat && !isArrow(e.key)) { e.preventDefault(); return; }

    if (dialog.open) return;               // the native dialog owns Esc and Tab

    var active = document.activeElement;

    if (e.key === 'Escape') {
      if (screenName !== 'home') { e.preventDefault(); goHome(); }
      return;
    }

    if (screenName === 'quiz') {
      /* 1-4 answer, and are ignored during reveal by the same guard the state
       * machine uses — a fast typist cannot answer the next question early. */
      if (phase === 'question' && e.key >= '1' && e.key <= '4' && e.key.length === 1) {
        e.preventDefault();
        answer(Number(e.key) - 1);
        return;
      }

      if (phase === 'reveal' && (e.key === 'Enter' || e.key === ' ')) {
        if (active && active.classList && active.classList.contains('opt')) {
          e.preventDefault();     // stop the option's own activation firing too
          advance();
          return;
        }
        if (active && (active.tagName === 'BUTTON' || active.tagName === 'A')) return;
        e.preventDefault();
        advance();
      }
    }
  }

  /* ---------------------------------------------------------------- *
   * Wiring
   * ---------------------------------------------------------------- */

  function wire() {
    btnPlay.addEventListener('click', startRound);
    btnProgress.addEventListener('click', goProgress);

    btnTheme.addEventListener('click', function () {
      var next = theme === 'dark' ? 'light' : 'dark';
      Progress.setTheme(next);
      applyTheme(next);
    });

    chipBox.addEventListener('click', function (e) {
      var chip = e.target.closest ? e.target.closest('.chip') : null;
      if (!chip || !chipBox.contains(chip)) return;
      Progress.setRegion(chip.getAttribute('data-region'));
      syncChips();
      chip.focus();
    });

    optionsBox.addEventListener('click', function (e) {
      var opt = e.target.closest ? e.target.closest('.opt') : null;
      if (!opt || !optionsBox.contains(opt)) return;
      answer(Number(opt.getAttribute('data-index')));
    });

    btnNext.addEventListener('click', advance);
    btnQuit.addEventListener('click', goHome);

    btnAgain.addEventListener('click', startRound);
    btnSummaryProgress.addEventListener('click', goProgress);
    btnSummaryHome.addEventListener('click', goHome);

    btnProgressHome.addEventListener('click', goHome);

    regionsBox.addEventListener('click', function (e) {
      var head = e.target.closest ? e.target.closest('.region__head') : null;
      if (!head || !regionsBox.contains(head)) return;
      var region = head.getAttribute('data-region-head');
      var open = head.getAttribute('aria-expanded') !== 'true';
      expanded[region] = open;
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
      var body = document.getElementById(head.getAttribute('aria-controls'));
      if (body) body.hidden = !open;
    });

    /* Two entry points, one dialog. The home link is deliberately quiet —
     * it is a destructive action sitting on the first screen. */
    function openResetDialog() {
      if (typeof dialog.showModal === 'function') dialog.showModal();
    }
    btnReset.addEventListener('click', openResetDialog);
    btnResetHome.addEventListener('click', openResetDialog);
    btnResetCancel.addEventListener('click', function () { dialog.close(); });
    btnResetConfirm.addEventListener('click', function () {
      Progress.reset();
      dialog.close();
      /* Refresh whichever screen is showing. Reset can now be fired from home,
       * where renderProgress alone would leave the stat tiles reading stale. */
      if (screenName === 'progress') renderProgress(); else renderHome();
      live.textContent = 'Progress reset.';
    });

    document.addEventListener('keydown', onKeydown);
  }

  /* ---------------------------------------------------------------- *
   * Boot
   * ---------------------------------------------------------------- */

  function fatal(message) {
    Object.keys(screens).forEach(function (k) { screens[k].hidden = true; });
    var sec = document.createElement('section');
    sec.className = 'screen';
    var card = document.createElement('div');
    card.className = 'card';
    var h = document.createElement('h1');
    h.className = 'screen__title';
    h.textContent = 'Sovereign cannot start';
    var p = document.createElement('p');
    p.className = 'summary__line';
    p.textContent = message;
    card.appendChild(h);
    card.appendChild(p);
    sec.appendChild(card);
    main.appendChild(sec);
  }

  function boot() {
    grab();

    /* Before the first call into either module, and each branch names the file
     * that is actually missing. A file:// app has no console anyone will read,
     * so a script that failed to load has to draw the panel, not throw. */
    if (!window.Progress) {
      fatal('The progress store did not load. Check that assets/js/storage.js is present.');
      return;
    }
    if (!window.Questions) {
      fatal('The question engine did not load. Check that assets/js/questions.js is present.');
      return;
    }
    if (!Questions.ready) {
      fatal(Questions.error || 'Country data could not be read. Check assets/js/data.js.');
      return;
    }

    Progress.load();
    if (!Progress.isPersistent()) notice.hidden = false;

    var stored = Progress.getTheme();
    if (stored !== 'light' && stored !== 'dark') {
      stored = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
        ? 'dark' : 'light';
    }
    applyTheme(stored);

    if (location.search.indexOf('audit=1') !== -1) {
      console.log('Sovereign audit', Questions.audit(2000));
    }

    wire();
    renderHome();
    show('home');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

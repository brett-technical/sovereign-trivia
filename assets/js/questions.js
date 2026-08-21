/* Sovereign — question generation.
 * Sets window.Questions. Depends on window.COUNTRY_DATA only.
 * Never touches the DOM, Progress, localStorage or Date. All randomness is Math.random.
 */
(function () {
  'use strict';

  var TYPES = ['capital', 'currency', 'language', 'population', 'industry'];
  var REGIONS = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];
  var TYPE_LABELS = {
    capital: 'Capital',
    currency: 'Currency',
    language: 'Language',
    population: 'Population',
    industry: 'Industry'
  };

  var Questions = {
    VERSION: 1,
    TYPES: TYPES,
    REGIONS: REGIONS,
    TYPE_LABELS: TYPE_LABELS,
    ready: false,
    error: null
  };
  window.Questions = Questions;

  /* ------------------------------------------------------------------ *
   * Word tables
   * ------------------------------------------------------------------ */

  var STOP_WORDS = new Set([
    'of', 'and', 'the', 'to', 'in', 'for', 'a', 'an', 'or', 'with',
    'from', 'its', 'on', 'at', 'by', 'de', 'facto'
  ]);

  /* Words that describe an activity rather than name one. Ranking only. */
  var GENERIC_INDUSTRY = new Set([
    'production', 'processing', 'manufacturing', 'mining', 'extraction',
    'refining', 'milling', 'products', 'services', 'goods', 'light',
    'assembly', 'export', 'exports', 'industries', 'industry', 'basic',
    'other', 'related'
  ]);

  /* Synonym classes: word -> class key. Exclusion only. */
  var SYNONYM_CLASSES = {
    coconut: ['copra', 'coconut', 'coconuts'],
    fish: ['fish', 'fishing', 'fisheries', 'fishery', 'fishmeal', 'seafood'],
    wood: ['wood', 'timber', 'lumber', 'logging', 'pulp', 'paper', 'plywood', 'furniture'],
    apparel: ['apparel', 'textiles', 'textile', 'garments', 'garment', 'clothing', 'footwear', 'carpets'],
    oil: ['oil', 'petroleum', 'crude', 'petrochemicals', 'petrochemical'],
    gas: ['gas', 'lng', 'liquefied'],
    auto: ['auto', 'automotive', 'automobile', 'automobiles', 'motor', 'vehicles'],
    chips: ['chips', 'electronics', 'electronic', 'semiconductors', 'microprocessors'],
    soft: ['software', 'biotechnology'],
    finance: ['finance', 'financial', 'banking', 'offshore', 'insurance', 'wealth'],
    tourism: ['tourism', 'travel', 'hospitality', 'casinos', 'resorts'],
    steel: ['steel', 'metallurgy', 'metalworking', 'metals', 'metal'],
    sugar: ['sugar'],
    drink: ['drink', 'beverages', 'beverage', 'brewing', 'beer', 'wine', 'rum', 'alcohol'],
    cement: ['cement', 'concrete'],
    farm: ['farm', 'agriculture', 'agricultural', 'farming', 'agro']
  };
  var SYNONYM = {};
  Object.keys(SYNONYM_CLASSES).forEach(function (key) {
    SYNONYM_CLASSES[key].forEach(function (word) { SYNONYM[word] = key; });
  });

  /* Languages that are one language under several names, or close enough that
   * a player could not be expected to tell them apart. Mutual veto. */
  var LANGUAGE_FAMILIES = [
    ['bosnian', 'croatian', 'serbian', 'montenegrin'],
    ['chinese', 'mandarin', 'mandarin chinese', 'standard chinese'],
    ['malay', 'indonesian'],
    ['persian', 'farsi', 'dari', 'tajik']
  ];
  var LANGUAGE_FAMILY = {};
  LANGUAGE_FAMILIES.forEach(function (family) {
    family.forEach(function (name) { LANGUAGE_FAMILY[name] = family[0]; });
  });

  /* Languages a country genuinely uses that its `languages` string never names.
   * Distractor exclusion only: nothing here is ever offered as an answer and the
   * Languages fact on the reveal is untouched. Without it the pool hands the
   * player Guaraní as a wrong answer for Bolivia and Tamil as one for India —
   * both defensibly right, and the engine cannot know that from the record. */
  var EXTRA_LANGUAGE_VETO = {
    'Afghanistan': ['Uzbek', 'Turkmen'],
    'Bolivia': ['Guaraní'],
    'Dominica': ['French'],
    'Ecuador': ['Quechua'],
    'Estonia': ['Russian'],
    'India': ['Bengali', 'Nepali', 'Tamil', 'Urdu'],
    'Kosovo': ['Turkish'],
    'Latvia': ['Russian'],
    'Libya': ['Berber'],
    'Lithuania': ['Russian'],
    'Moldova': ['Russian'],
    'Namibia': ['Afrikaans'],
    'North Macedonia': ['Turkish'],
    'Pakistan': ['Pashto'],
    'Romania': ['Hungarian'],
    'Saint Lucia': ['French'],
    'Spain': ['Catalan'],
    'Tunisia': ['Berber'],
    'Turkey': ['Kurdish'],
    'Ukraine': ['Russian']
  };

  /* Words inside a language parenthetical that describe status, not a language. */
  var LANGUAGE_NOISE = new Set([
    'widely', 'spoken', 'common', 'commonly', 'de', 'facto', 'official',
    'etc', 'and', 'also', 'plus', 'national', 'languages', 'language'
  ]);

  /* Words in a country name that carry no identity of their own. */
  var GENERIC_NAME_WORDS = new Set([
    'south', 'north', 'central', 'united', 'republic', 'states', 'saint',
    'new', 'democratic', 'federated', 'islands', 'kingdom', 'of', 'the', 'and'
  ]);

  var NAME_ARTICLE = /Republic|Kingdom|States|Islands|Emirates|Netherlands|Bahamas|Gambia|Philippines|Comoros|Maldives|Holy See/;

  /* ------------------------------------------------------------------ *
   * Small utilities
   * ------------------------------------------------------------------ */

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }

  function weightedPick(items, weightOf) {
    var total = 0, i, w, weights = [];
    for (i = 0; i < items.length; i++) {
      w = weightOf(items[i], i);
      if (!isFinite(w) || w < 0) w = 0;
      weights.push(w);
      total += w;
    }
    if (total <= 0) return items[Math.floor(Math.random() * items.length)];
    var r = Math.random() * total;
    for (i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  function upperFirst(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function lowerFirst(s) {
    if (!s) return s;
    var first = s.split(/\s+/)[0];
    /* Leave acronyms alone. */
    if (first.length > 1 && first === first.toUpperCase() && /[A-Z]/.test(first)) return s;
    return s.charAt(0).toLowerCase() + s.slice(1);
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function intersects(set, other) {
    var hit = false;
    other.forEach(function (v) { if (set.has(v)) hit = true; });
    return hit;
  }

  /* ------------------------------------------------------------------ *
   * Parse layer (§12.1) — pure, run once at load
   * ------------------------------------------------------------------ */

  /* Split on ',' and ';' at parenthesis depth 0 only. A naive split(',')
   * shreds "11 official (Zulu, Xhosa, ... etc.)" into nonsense tokens. */
  function splitTop(s) {
    var out = [], depth = 0, buf = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      if ((ch === ',' || ch === ';') && depth === 0) {
        if (buf.trim()) out.push(buf.trim());
        buf = '';
      } else {
        buf += ch;
      }
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  function parsePopulation(s) {
    var m = String(s).replace(/,/g, '').trim()
      .match(/^([0-9]*\.?[0-9]+)\s*(Billion|Million|Thousand)?$/i);
    if (!m) return NaN;
    var n = parseFloat(m[1]);
    var unit = m[2] ? m[2].toLowerCase() : '';
    if (unit === 'billion') n *= 1e9;
    else if (unit === 'million') n *= 1e6;
    else if (unit === 'thousand') n *= 1e3;
    return n;
  }

  /* Every 3-uppercase-letter token inside every parenthesis. */
  function isoSet(currency) {
    var codes = new Set();
    var re = /\(([^)]*)\)/g, m;
    while ((m = re.exec(currency)) !== null) {
      m[1].split(/[\/,]/).forEach(function (piece) {
        var code = piece.trim();
        if (/^[A-Z]{3}$/.test(code)) codes.add(code);
      });
    }
    return codes;
  }

  function isoKey(codes) {
    return Array.from(codes).sort().join('|');
  }

  function languageFamily(name) {
    var k = String(name).toLowerCase().replace(/\s+/g, ' ').trim();
    return LANGUAGE_FAMILY[k] || k;
  }

  /* Strip a trailing "(...)" gloss and any status wording. */
  function cleanLanguageToken(token) {
    return token.replace(/\s*\([^)]*\)\s*$/, '').trim();
  }

  function cleanLanguagePiece(piece) {
    var words = piece.split(/[^A-Za-zÀ-ÿ'Ā-ɏ]+/)
      .filter(function (w) { return w && !LANGUAGE_NOISE.has(w.toLowerCase()); });
    return words.join(' ').trim();
  }

  function parseLanguages(s) {
    var openSet = /^\d+\s*official/i.test(s) || /etc\./i.test(s);
    var tokens = splitTop(s);
    var answerable = [];
    var veto = new Set();

    function addVeto(name) {
      if (!name) return;
      if (/^\d/.test(name)) return;
      veto.add(languageFamily(name));
    }

    if (openSet) {
      var inner = (s.match(/\(([^)]*)\)/) || [null, ''])[1];
      inner.split(',').forEach(function (piece) {
        var name = cleanLanguagePiece(piece);
        if (!name || /^etc$/i.test(name)) return;
        answerable.push(name);
        addVeto(name);
      });
    } else {
      tokens.forEach(function (token) {
        var head = cleanLanguageToken(token);
        if (head && !/^\d/.test(head)) {
          answerable.push(head);
          addVeto(head);
        }
      });
    }

    /* Veto absorbs everything the record mentions, parentheticals included. */
    tokens.forEach(function (token) {
      addVeto(cleanLanguageToken(token));
      var re = /\(([^)]*)\)/g, m;
      while ((m = re.exec(token)) !== null) {
        m[1].split(/[,\/]/).forEach(function (piece) {
          var name = cleanLanguagePiece(piece);
          if (name && !/^etc$/i.test(name)) addVeto(name);
        });
      }
    });

    return { answerable: answerable, veto: veto, openSet: openSet };
  }

  function contentWords(text) {
    return text.toLowerCase().split(/[^a-z0-9]+/)
      .filter(function (w) { return w.length >= 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w); });
  }

  function mapSynonyms(words) {
    var out = new Set();
    words.forEach(function (w) { out.add(SYNONYM[w] || w); });
    return out;
  }

  function industryTokens(s, countryNameRe) {
    return splitTop(s).map(function (token) {
      var outside = token.replace(/\([^)]*\)/g, ' ');
      var head = contentWords(outside).filter(function (w) { return !GENERIC_INDUSTRY.has(w); });

      var veto = mapSynonyms(contentWords(token));

      /* Drop any parenthetical that names a country — it leaks the answer. */
      var display = token.replace(/\s*\(([^)]*)\)/g, function (whole, inner) {
        return countryNameRe && countryNameRe.test(inner) ? '' : whole;
      }).replace(/\s+/g, ' ').trim();
      display = lowerFirst(display);

      return { token: token, head: head, veto: veto, display: display };
    });
  }

  /* Prose form of a country name. Stems only — option labels keep the
   * canonical string. Rewrites exactly 18 of the 197. */
  function promptName(country) {
    var m = country.match(/^(.+?)\s*\((.+?)\)$/);
    if (m && /\bof(\s+the)?$/i.test(m[2])) {
      return 'the ' + m[2] + ' ' + m[1];
    }
    var head = country.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (NAME_ARTICLE.test(head)) return 'the ' + head;
    return head;
  }

  /* ------------------------------------------------------------------ *
   * Index — built once at load
   * ------------------------------------------------------------------ */

  var REC = {};              /* country -> raw record */
  var INFO = {};             /* country -> parsed record */
  var REGION_LIST = {};      /* region -> [country] sorted */
  var ALL_COUNTRIES = [];
  var AVAILABLE = {};        /* country -> [type] */
  var LANG_CORPUS_FREQ = {}; /* familyKey -> countries listing it, corpus-wide */
  var LANG_REGION_FREQ = {}; /* region -> familyKey -> countries listing it */
  var INDUSTRY_DOC_FREQ = {};/* head word -> countries whose industries use it */
  var COUNTRY_NAME_RE = null;

  function buildIndex() {
    var data = window.COUNTRY_DATA;
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('COUNTRY_DATA is missing or empty.');
    }

    var bareNames = [];
    data.forEach(function (r) {
      if (!r || typeof r.country !== 'string' || !r.country) throw new Error('A record has no country name.');
      if (REC[r.country]) throw new Error('Duplicate country: ' + r.country);
      REC[r.country] = r;
      ALL_COUNTRIES.push(r.country);
      bareNames.push(r.country.replace(/\s*\([^)]*\)\s*$/, '').trim());
      var alt = (r.country.match(/\(([^)]*)\)/) || [null, ''])[1];
      if (alt && !/\bof(\s+the)?$/i.test(alt)) bareNames.push(alt.trim());
    });

    var namePattern = bareNames
      .filter(function (n) { return n.length >= 4; })
      .sort(function (a, b) { return b.length - a.length; })
      .map(escapeRe).join('|');
    COUNTRY_NAME_RE = new RegExp('\\b(' + namePattern + ')\\b', 'i');

    data.forEach(function (r) {
      var langs = parseLanguages(r.languages || '');
      var pop = parsePopulation(r.population || '');
      if (!isFinite(pop)) throw new Error('Unparseable population for ' + r.country);
      var inds = industryTokens(r.industries || '', COUNTRY_NAME_RE);
      var iso = isoSet(r.currency || '');

      INFO[r.country] = {
        country: r.country,
        region: r.region,
        capital: r.capital,
        accepted: Array.isArray(r.accepted_capitals) ? r.accepted_capitals : [],
        languagesRaw: r.languages,
        currencyRaw: r.currency,
        populationRaw: r.population,
        industriesRaw: r.industries,
        langs: langs,
        pop: pop,
        iso: iso,
        isoKey: isoKey(iso),
        inds: inds,
        indWords: mapSynonyms(contentWords(r.industries || '')),
        prompt: promptName(r.country)
      };

      if (!REGION_LIST[r.region]) REGION_LIST[r.region] = [];
      REGION_LIST[r.region].push(r.country);
    });

    REGIONS.forEach(function (region) {
      if (!REGION_LIST[region]) REGION_LIST[region] = [];
      REGION_LIST[region].sort(function (a, b) { return a.localeCompare(b, 'en'); });
      LANG_REGION_FREQ[region] = {};
    });
    ALL_COUNTRIES.sort(function (a, b) { return a.localeCompare(b, 'en'); });

    /* Language frequencies: a language "listed by" a country means any mention,
     * parentheticals included, because absence in the corpus is not evidence. */
    ALL_COUNTRIES.forEach(function (c) {
      var info = INFO[c];
      info.langs.veto.forEach(function (family) {
        LANG_CORPUS_FREQ[family] = (LANG_CORPUS_FREQ[family] || 0) + 1;
        var perRegion = LANG_REGION_FREQ[info.region];
        if (perRegion) perRegion[family] = (perRegion[family] || 0) + 1;
      });
    });

    /* Applied after the frequency pass: the table says what a country must never
     * be offered, not what the corpus says it speaks. */
    ALL_COUNTRIES.forEach(function (c) {
      (EXTRA_LANGUAGE_VETO[c] || []).forEach(function (name) {
        INFO[c].langs.veto.add(languageFamily(name));
      });
    });

    /* Industry head-word document frequency, for rarity ranking. */
    ALL_COUNTRIES.forEach(function (c) {
      var seen = new Set();
      INFO[c].inds.forEach(function (t) {
        t.head.forEach(function (w) { seen.add(w); });
      });
      seen.forEach(function (w) {
        INDUSTRY_DOC_FREQ[w] = (INDUSTRY_DOC_FREQ[w] || 0) + 1;
      });
    });

    /* Industry clue ranking, then availability for every country and type. */
    ALL_COUNTRIES.forEach(function (c) {
      INFO[c].indRanked = rankIndustryTokens(c);
      INFO[c].indTwin = ALL_COUNTRIES.some(function (o) {
        return o !== c && REC[o].industries === REC[c].industries;
      });
    });
    ALL_COUNTRIES.forEach(function (c) {
      INFO[c].clues = pickIndustryClues(c);
      AVAILABLE[c] = TYPES.filter(function (t) { return computeAvailable(c, t); });
    });
  }

  function rankIndustryTokens(country) {
    var tokens = INFO[country].inds.map(function (t, i) {
      var score = Infinity;
      t.head.forEach(function (w) {
        var f = INDUSTRY_DOC_FREQ[w] || 1;
        if (f < score) score = f;
      });
      return { t: t, score: score, order: i };
    });
    tokens.sort(function (a, b) {
      if (a.score !== b.score) return a.score - b.score;
      return a.order - b.order;
    });
    return tokens.map(function (x) { return x.t; });
  }

  /* ------------------------------------------------------------------ *
   * Candidate pools — one function per type, shared by availability and
   * generation so the two can never disagree.
   * ------------------------------------------------------------------ */

  function peers(country) {
    var region = INFO[country].region;
    return (REGION_LIST[region] || []).filter(function (c) { return c !== country; });
  }

  function capitalPool(country) {
    var info = INFO[country];
    var banned = new Set(info.accepted.map(function (c) { return c.toLowerCase(); }));
    var seen = new Set();
    var out = [];
    peers(country).forEach(function (other) {
      var city = INFO[other].accepted[0];
      if (!city) return;
      var key = city.toLowerCase();
      if (banned.has(key) || seen.has(key)) return;
      seen.add(key);
      out.push(city);
    });
    return out;
  }

  function currencyPool(country) {
    var info = INFO[country];
    var seen = new Set();
    var out = [];
    peers(country).forEach(function (other) {
      var o = INFO[other];
      if (intersects(info.iso, o.iso)) return;
      if (seen.has(o.isoKey)) return;
      seen.add(o.isoKey);
      out.push({ label: o.currencyRaw, iso: o.iso, isoKey: o.isoKey });
    });
    return out;
  }

  /* A currency whose name echoes the country being asked about is unfair,
   * not untrue. Deprioritised, never banned. */
  function misleadingFor(country, label) {
    var stems = [];
    country.toLowerCase().split(/[^a-z]+/).forEach(function (w) {
      if (!w || GENERIC_NAME_WORDS.has(w) || w.length < 3) return;
      stems.push(w.slice(0, 5));
    });
    if (!stems.length) return false;
    var words = label.toLowerCase().split(/[^a-z]+/);
    for (var i = 0; i < words.length; i++) {
      for (var j = 0; j < stems.length; j++) {
        var stem = stems[j];
        if (words[i].length >= stem.length + 2 && words[i].indexOf(stem) === 0) return true;
      }
    }
    return false;
  }

  function languagePool(country) {
    var info = INFO[country];
    var regionFreq = LANG_REGION_FREQ[info.region] || {};
    var byFamily = new Map();
    peers(country).forEach(function (other) {
      INFO[other].langs.answerable.forEach(function (name) {
        var family = languageFamily(name);
        if (info.langs.veto.has(family)) return;      /* the answer's own family tree */
        if ((regionFreq[family] || 0) >= 3) return;   /* regional lingua franca */
        if (!byFamily.has(family)) byFamily.set(family, name);
      });
    });
    var out = [];
    byFamily.forEach(function (name, family) { out.push({ label: name, family: family }); });
    return out;
  }

  function populationPool(country, polarity) {
    var p = INFO[country].pop;
    var eligible = [], band = [];
    peers(country).forEach(function (other) {
      var q = INFO[other].pop;
      if (polarity === 'largest') {
        if (q > p / 1.25) return;
        eligible.push(other);
        if (q >= p / 8) band.push(other);
      } else {
        if (q < p * 1.25) return;
        eligible.push(other);
        if (q <= p * 8) band.push(other);
      }
    });
    return band.length >= 3 ? band : eligible;
  }

  function industryPool(country, clues) {
    var clueWords = new Set();
    clues.forEach(function (t) { t.veto.forEach(function (w) { clueWords.add(w); }); });
    return peers(country).filter(function (other) {
      return !intersects(clueWords, INFO[other].indWords);
    });
  }

  /* Rarest head words first, dropping to two then one clue when three would
   * starve the distractor pool. */
  function pickIndustryClues(country) {
    var ranked = INFO[country].indRanked;
    if (!ranked.length) return null;
    for (var n = Math.min(3, ranked.length); n >= 1; n--) {
      var clues = ranked.slice(0, n);
      if (clues.some(function (t) { return !t.display; })) continue;
      if (industryPool(country, clues).length >= 3) return clues;
    }
    return null;
  }

  function computeAvailable(country, type) {
    var info = INFO[country];
    switch (type) {
      case 'capital':
        return !!info.accepted[0] && capitalPool(country).length >= 3;
      case 'currency':
        return !!info.currencyRaw && currencyPool(country).length >= 3;
      case 'language':
        return !info.langs.openSet &&
          info.langs.answerable.length > 0 &&
          languagePool(country).length >= 3;
      case 'population':
        return populationPool(country, 'largest').length >= 3 ||
          populationPool(country, 'smallest').length >= 3;
      case 'industry':
        return !info.indTwin && !!info.clues;
      default:
        return false;
    }
  }

  /* ------------------------------------------------------------------ *
   * Question construction
   * ------------------------------------------------------------------ */

  function factsFor(country) {
    var info = INFO[country];
    return [
      { key: 'capital', label: 'Capital', value: info.capital },
      { key: 'languages', label: 'Languages', value: info.languagesRaw },
      { key: 'currency', label: 'Currency', value: info.currencyRaw },
      { key: 'population', label: 'Population', value: info.populationRaw },
      { key: 'industries', label: 'Industries', value: info.industriesRaw }
    ];
  }

  function pickSlot(slots) {
    var i = weightedPick([0, 1, 2, 3], function (idx) { return 1 / (1 + slots[idx]); });
    for (var k = 0; k < 4; k++) slots[k] *= 0.9;
    slots[i] += 1;
    return i;
  }

  function place(answer, distractors, slots) {
    var d = shuffle(distractors.slice()).slice(0, 3);
    var index = pickSlot(slots);
    var options = d.slice(0, index).concat([answer], d.slice(index));
    return { options: options, answerIndex: index };
  }

  function joinClues(list) {
    if (list.length === 1) return list[0];
    if (list.length === 2) return list[0] + ' and ' + list[1];
    return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
  }

  function makeQuestion(country, type, indexInRound, slots) {
    var info = INFO[country];
    var built = null;

    if (type === 'capital') {
      var pool = capitalPool(country);
      if (pool.length < 3) return null;
      var city = info.accepted[0];
      built = place(city, pool, slots);
      return finish({
        type: type, country: country, indexInRound: indexInRound,
        prompt: 'What is the capital of ' + info.prompt + '?',
        options: built.options, answerIndex: built.answerIndex,
        headline: city, askedKey: 'capital',
        /* "Washington, D.C." already carries its stop; nothing else does. */
        sentence: 'The capital of ' + info.prompt + ' is ' + city + (/\.$/.test(city) ? '' : '.'),
        note: null
      });
    }

    if (type === 'currency') {
      var cpool = currencyPool(country);
      if (cpool.length < 3) return null;
      var fair = cpool.filter(function (c) { return !misleadingFor(country, c.label); });
      var unfair = cpool.filter(function (c) { return misleadingFor(country, c.label); });
      var chosen = shuffle(fair.slice());
      if (chosen.length < 3) chosen = chosen.concat(shuffle(unfair.slice()));
      var labels = chosen.slice(0, 3).map(function (c) { return c.label; });
      built = place(info.currencyRaw, labels, slots);
      return finish({
        type: type, country: country, indexInRound: indexInRound,
        prompt: 'Which currency does ' + info.prompt + ' use?',
        options: built.options, answerIndex: built.answerIndex,
        headline: info.currencyRaw, askedKey: 'currency',
        sentence: upperFirst(info.prompt) + ' uses the ' + info.currencyRaw + '.',
        note: null
      });
    }

    if (type === 'language') {
      var lpool = languagePool(country);
      if (lpool.length < 3 || !info.langs.answerable.length) return null;
      /* Inverse corpus frequency: Fiji asks Fijian, not English. */
      var answer = weightedPick(info.langs.answerable, function (name) {
        return 1 / Math.max(1, LANG_CORPUS_FREQ[languageFamily(name)] || 1);
      });
      var picks = shuffle(lpool.slice()).slice(0, 3).map(function (c) { return c.label; });
      built = place(answer, picks, slots);
      return finish({
        type: type, country: country, indexInRound: indexInRound,
        prompt: 'Which of these is a main language of ' + info.prompt + '?',
        options: built.options, answerIndex: built.answerIndex,
        headline: answer, askedKey: 'languages',
        sentence: answer + ' is a main language of ' + info.prompt + '.',
        note: null
      });
    }

    if (type === 'population') {
      var polarities = ['largest', 'smallest'];
      if (Math.random() < 0.5) polarities.reverse();
      for (var pi = 0; pi < polarities.length; pi++) {
        var polarity = polarities[pi];
        var ppool = populationPool(country, polarity);
        if (ppool.length < 3) continue;
        var others = shuffle(ppool.slice()).slice(0, 3);
        built = place(country, others, slots);
        var four = built.options.slice().sort(function (a, b) { return INFO[b].pop - INFO[a].pop; });
        var note = four.map(function (c) { return c + ' ' + INFO[c].populationRaw; }).join(' · ');
        return finish({
          type: type, country: country, indexInRound: indexInRound,
          prompt: 'Which of these countries has the ' + polarity + ' population?',
          options: built.options, answerIndex: built.answerIndex,
          headline: country, askedKey: 'population',
          sentence: upperFirst(info.prompt) + ' has the ' + polarity + ' population of the four.',
          note: note
        });
      }
      return null;
    }

    if (type === 'industry') {
      var clues = info.clues;
      if (!clues) return null;
      var ipool = industryPool(country, clues);
      if (ipool.length < 3) return null;
      var phrase = joinClues(clues.map(function (t) { return t.display; }));
      built = place(country, shuffle(ipool.slice()).slice(0, 3), slots);
      /* Same name the other four types use, so the two halves of the screen
       * agree; a name already ending in s takes the bare apostrophe. */
      var owner = upperFirst(info.prompt);
      owner += /s$/.test(owner) ? '\'' : '\'s';
      return finish({
        type: type, country: country, indexInRound: indexInRound,
        prompt: 'Which country\'s economy runs on ' + phrase + '?',
        options: built.options, answerIndex: built.answerIndex,
        headline: country, askedKey: 'industries',
        sentence: owner + ' economy runs on ' + phrase + '.',
        note: null
      });
    }

    return null;
  }

  function finish(spec) {
    var info = INFO[spec.country];
    /* Distinctness is a hard guarantee; refuse rather than ship a broken item. */
    var seen = {};
    for (var i = 0; i < spec.options.length; i++) {
      if (typeof spec.options[i] !== 'string' || !spec.options[i]) return null;
      if (seen[spec.options[i]]) return null;
      seen[spec.options[i]] = true;
    }
    if (spec.options.length !== 4) return null;

    return {
      id: spec.type + '|' + spec.country + '|' + spec.indexInRound,
      type: spec.type,
      countryKey: spec.country,
      region: info.region,
      prompt: spec.prompt,
      options: spec.options,
      answerIndex: spec.answerIndex,
      reveal: {
        country: spec.country,
        region: info.region,
        headline: spec.headline,
        sentence: spec.sentence,
        askedKey: spec.askedKey,
        facts: factsFor(spec.country),
        note: spec.note
      }
    };
  }

  /* ------------------------------------------------------------------ *
   * Public surface
   * ------------------------------------------------------------------ */

  Questions.regionOf = function (countryKey) {
    var info = INFO[countryKey];
    return info ? info.region : null;
  };

  Questions.countriesIn = function (region) {
    if (region === 'all') return ALL_COUNTRIES.slice();
    return (REGION_LIST[region] || []).slice();
  };

  Questions.availableTypes = function (countryKey) {
    return AVAILABLE[countryKey] ? AVAILABLE[countryKey].slice() : [];
  };

  Questions.isAvailable = function (countryKey, type) {
    return !!AVAILABLE[countryKey] && AVAILABLE[countryKey].indexOf(type) !== -1;
  };

  Questions.totalPairs = function (region) {
    return Questions.countriesIn(region).reduce(function (sum, c) {
      return sum + (AVAILABLE[c] ? AVAILABLE[c].length : 0);
    }, 0);
  };

  function isSlot(n) {
    return typeof n === 'number' && isFinite(n) && n === Math.floor(n) && n >= 0 && n <= 3;
  }

  Questions.grade = function (question, optionIndex) {
    var q = (question && typeof question === 'object') ? question : null;
    var answerIndex = (q && isSlot(q.answerIndex)) ? q.answerIndex : 0;
    /* A malformed question grades as wrong, never as right. */
    var wellFormed = !!q && isSlot(q.answerIndex) &&
      Array.isArray(q.options) && q.options.length === 4;
    var ok = wellFormed && isSlot(optionIndex) && optionIndex === answerIndex;
    return { correct: ok, answerIndex: answerIndex };
  };

  Questions.buildRound = function (progressState, options) {
    if (!Questions.ready) return [];
    try {
      return buildRoundInner(progressState, options);
    } catch (e) {
      return [];
    }
  };

  function buildRoundInner(progressState, options) {
    var opts = (options && typeof options === 'object') ? options : {};
    var count = 10;
    if (typeof opts.count === 'number' && isFinite(opts.count)) count = Math.floor(opts.count);
    count = Math.max(1, Math.min(50, count));

    var region = typeof opts.region === 'string' ? opts.region : 'all';
    if (region !== 'all' && REGIONS.indexOf(region) === -1) region = 'all';

    var state = (progressState && typeof progressState === 'object') ? progressState : {};
    var storedPairs = (state.pairs && typeof state.pairs === 'object') ? state.pairs : {};
    var clock = (typeof state.questionIndex === 'number' && isFinite(state.questionIndex)) ? state.questionIndex : 0;
    var recent = Array.isArray(state.recent) ? state.recent : [];
    var slots = [0, 0, 0, 0];
    if (Array.isArray(state.slots) && state.slots.length === 4) {
      for (var s = 0; s < 4; s++) {
        var v = state.slots[s];
        slots[s] = (typeof v === 'number' && isFinite(v) && v >= 0) ? v : 0;
      }
    }

    var countries = Questions.countriesIn(region);
    var pool = [];
    countries.forEach(function (c) {
      (AVAILABLE[c] || []).forEach(function (t) {
        pool.push({ country: c, type: t, key: c + '|' + t });
      });
    });
    if (!pool.length) return [];

    var poolCountries = countries.filter(function (c) {
      return AVAILABLE[c] && AVAILABLE[c].length > 0;
    }).length;

    var maxPerType = Math.max(2, Math.ceil(count * 0.3));
    var recentBlockN = Math.min(6, Math.max(0, poolCountries - count));
    var recentBlocked = new Set(recent.slice(Math.max(0, recent.length - recentBlockN)));

    var usedCountry = new Set();
    var typeCount = {};
    var dead = new Set();
    var out = [];
    var attempts = 0;
    var maxAttempts = count * 40 + 200;

    while (out.length < count && attempts < maxAttempts) {
      attempts++;

      var base = pool.filter(function (p) {
        return !usedCountry.has(p.country) && !dead.has(p.key);
      });
      if (!base.length) break;

      var tier1 = base.filter(function (p) {
        return (typeCount[p.type] || 0) < maxPerType && !recentBlocked.has(p.country);
      });
      var tier2 = base.filter(function (p) { return !recentBlocked.has(p.country); });
      var candidates = tier1.length ? tier1 : (tier2.length ? tier2 : base);

      var pick = weightedPick(candidates, function (p) {
        return pairWeight(storedPairs[p.key], clock);
      });

      var q = makeQuestion(pick.country, pick.type, out.length, slots);
      if (!q) { dead.add(pick.key); continue; }

      out.push(q);
      usedCountry.add(pick.country);
      typeCount[pick.type] = (typeCount[pick.type] || 0) + 1;
    }

    return out;
  }

  function pairWeight(pair, clock) {
    var w;
    if (pair && typeof pair === 'object') {
      var level = (typeof pair.l === 'number' && isFinite(pair.l) && pair.l > 0) ? pair.l : 0;
      w = 6 / Math.pow(2, level);
      if (typeof pair.wi === 'number' && pair.wi >= 0 && clock - pair.wi <= 30) w *= 2;
      if (typeof pair.ai === 'number' && pair.ai >= 0 && clock - pair.ai <= 20) w *= 0.1;
    } else {
      w = 8;
    }
    return w;
  }

  /* ------------------------------------------------------------------ *
   * Audit (§13.1) — index.html?audit=1
   * ------------------------------------------------------------------ */

  Questions.audit = function (sampleCount) {
    var result = { built: 0, violations: [] };
    if (!Questions.ready) {
      result.violations.push('Questions is not ready: ' + Questions.error);
      return result;
    }
    var n = (typeof sampleCount === 'number' && isFinite(sampleCount)) ? Math.floor(sampleCount) : 1000;
    n = Math.max(1, Math.min(200000, n));

    var slots = [0, 0, 0, 0];
    var fails = {};
    function fail(line) {
      if (fails[line]) { fails[line]++; return; }
      fails[line] = 1;
      if (result.violations.length < 200) result.violations.push(line);
    }

    for (var i = 0; i < n; i++) {
      var country = ALL_COUNTRIES[Math.floor(Math.random() * ALL_COUNTRIES.length)];
      var types = AVAILABLE[country] || [];
      if (!types.length) continue;
      var type = types[Math.floor(Math.random() * types.length)];
      var q = makeQuestion(country, type, i, slots);
      if (!q) { fail('build failed for ' + country + '/' + type); continue; }
      result.built++;
      checkQuestion(q, fail);
    }
    return result;
  };

  function checkQuestion(q, fail) {
    var where = q.type + '/' + q.countryKey;
    var info = INFO[q.countryKey];

    /* 1. Four distinct options. */
    if (q.options.length !== 4) fail(where + ': option count ' + q.options.length);
    if (new Set(q.options).size !== q.options.length) fail(where + ': duplicate options');

    /* 2. answerIndex sane and pointing at the intended answer. */
    if (!(q.answerIndex >= 0 && q.answerIndex <= 3 && q.answerIndex === Math.floor(q.answerIndex))) {
      fail(where + ': answerIndex ' + q.answerIndex);
      return;
    }
    var answer = q.options[q.answerIndex];
    var distractors = q.options.filter(function (o, i) { return i !== q.answerIndex; });

    if (q.reveal.facts.length !== 5) fail(where + ': facts length ' + q.reveal.facts.length);
    if (q.type === 'population' && !q.reveal.note) fail(where + ': population note missing');
    if (q.type !== 'population' && q.reveal.note !== null) fail(where + ': note should be null');

    if (q.type === 'capital') {
      /* 3. */
      if (answer !== info.accepted[0]) fail(where + ': answer is not accepted_capitals[0]');
      var accepted = new Set(info.accepted.map(function (c) { return c.toLowerCase(); }));
      distractors.forEach(function (d) {
        if (accepted.has(d.toLowerCase())) fail(where + ': distractor "' + d + '" is an accepted capital');
      });
      if (new Set(q.options.map(function (o) { return o.toLowerCase(); })).size !== 4) {
        fail(where + ': options collide case-insensitively');
      }
    }

    if (q.type === 'currency') {
      /* 4. */
      if (answer !== info.currencyRaw) fail(where + ': answer is not the record currency');
      var keys = new Set();
      distractors.forEach(function (d) {
        var set = isoSet(d);
        if (intersects(info.iso, set)) fail(where + ': distractor "' + d + '" shares an ISO code');
        var k = isoKey(set);
        if (keys.has(k)) fail(where + ': two distractors share ISO set ' + k);
        keys.add(k);
      });
    }

    if (q.type === 'language') {
      /* 5. */
      if (info.langs.answerable.indexOf(answer) === -1) fail(where + ': answer is not an answerable language');
      var fam = new Set();
      q.options.forEach(function (o) {
        var f = languageFamily(o);
        if (fam.has(f)) fail(where + ': two options share family ' + f);
        fam.add(f);
        if (/[()]/.test(o) || /^\d/.test(o) || /etc/i.test(o)) fail(where + ': malformed language token "' + o + '"');
      });
      distractors.forEach(function (d) {
        if (info.langs.veto.has(languageFamily(d))) fail(where + ': distractor "' + d + '" is vetoed');
      });
    }

    if (q.type === 'population') {
      /* 6 + 8. */
      var largest = /largest/.test(q.prompt);
      var p = info.pop;
      distractors.forEach(function (d) {
        if (!INFO[d]) { fail(where + ': unknown option ' + d); return; }
        if (INFO[d].region !== info.region) fail(where + ': distractor "' + d + '" is out of region');
        var ratio = largest ? p / INFO[d].pop : INFO[d].pop / p;
        if (!(ratio >= 1.25)) fail(where + ': "' + d + '" is only ' + ratio.toFixed(3) + 'x away');
      });
    }

    if (q.type === 'industry') {
      /* 7 + 8. */
      if (answer !== q.countryKey) fail(where + ': answer is not the country');
      var clueWords = new Set();
      info.clues.forEach(function (t) { t.veto.forEach(function (w) { clueWords.add(w); }); });
      distractors.forEach(function (d) {
        if (!INFO[d]) { fail(where + ': unknown option ' + d); return; }
        if (INFO[d].region !== info.region) fail(where + ': distractor "' + d + '" is out of region');
        if (intersects(clueWords, INFO[d].indWords)) {
          fail(where + ': distractor "' + d + '" shares a clue word');
        }
      });
      var stem = q.prompt.replace(/^Which country's economy runs on /, '').replace(/\?$/, '');
      var hit = stem.match(COUNTRY_NAME_RE);
      if (hit) fail(where + ': clue text names "' + hit[1] + '"');
    }
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  try {
    buildIndex();
    Questions.ready = true;
    Questions.error = null;
  } catch (e) {
    Questions.ready = false;
    Questions.error = 'Country data could not be read. ' +
      ((e && e.message) ? e.message : 'Unknown error.');
  }
})();

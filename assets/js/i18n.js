/**
 * PrePortal — i18n core
 * Languages: lang/<code>.json · every interface string comes from there.
 */
(function (w, d) {
  'use strict';

  var LS_KEY = 'preportal:lang';
  var FALLBACK = 'en';
  var cache = {};
  var dict = {};
  var current = FALLBACK;

  function cfg() { return w.PREPORTAL_CONFIG || {}; }

  function available() {
    return cfg().langs || ['en', 'tr', 'ru'];
  }

  function deepGet(obj, path) {
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return null;
      cur = cur[parts[i]];
    }
    return cur == null ? null : cur;
  }

  function interpolate(str, vars) {
    if (!vars) return str;
    return String(str).replace(/\{(\w+)\}/g, function (m, k) {
      return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m;
    });
  }

  /** t('post.readingTime', {n: 4}) */
  function t(key, vars) {
    var v = deepGet(dict, key);
    if (v == null) v = deepGet(cache[FALLBACK] || {}, key);
    if (v == null) return key;
    return typeof v === 'string' ? interpolate(v, vars) : v;
  }

  function meta() {
    return dict._meta || (cache[FALLBACK] && cache[FALLBACK]._meta) || { code: current, name: current, dir: 'ltr', intl: current };
  }

  function fetchLang(code) {
    if (cache[code]) return Promise.resolve(cache[code]);
    var url = (cfg().langDir || 'lang') + '/' + code + '.json';
    return fetch(url, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error(url + ' → HTTP ' + r.status);
        return r.json();
      })
      .then(function (json) {
        cache[code] = json;
        return json;
      });
  }

  function detect() {
    /* ?lang=… is honoured once and then remembered, so switching keeps working on every page */
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q && available().indexOf(q) > -1) {
        try { localStorage.setItem(LS_KEY, q); } catch (e) {}
        return q;
      }
    } catch (e0) {}
    try {
      var saved = localStorage.getItem(LS_KEY);
      if (saved && available().indexOf(saved) > -1) return saved;
    } catch (e2) {}
    var nav = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']).filter(Boolean);
    for (var i = 0; i < nav.length; i++) {
      var code = String(nav[i]).toLowerCase().split('-')[0];
      if (available().indexOf(code) > -1) return code;
    }
    return cfg().defaultLang || FALLBACK;
  }

  /** [data-i18n], [data-i18n-html], [data-i18n-attr="placeholder:key,title:key2"] */
  function apply(root) {
    root = root || d;
    var nodes = root.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var val = t(el.getAttribute('data-i18n'));
      if (typeof val === 'string') el.textContent = val;
    }
    /* [data-i18n-tpl] holds HTML with {site}/{year} placeholders */
    var tplFirst = root.querySelectorAll('[data-i18n-tpl]');
    for (var m0 = 0; m0 < tplFirst.length; m0++) {
      tplFirst[m0].innerHTML = t(tplFirst[m0].getAttribute('data-i18n-tpl'), {
        site: cfg().siteName || 'PrePortal',
        year: new Date().getFullYear()
      });
    }
    var htmls = root.querySelectorAll('[data-i18n-html]');
    for (var j = 0; j < htmls.length; j++) {
      var h = htmls[j];
      var hv = t(h.getAttribute('data-i18n-html'));
      if (typeof hv === 'string') h.innerHTML = hv;
    }
    var attrs = root.querySelectorAll('[data-i18n-attr]');
    for (var k = 0; k < attrs.length; k++) {
      (function (node) {
        node.getAttribute('data-i18n-attr').split(',').forEach(function (pair) {
          var bits = pair.split(':');
          var attr = (bits[0] || '').trim();
          var key = (bits[1] || '').trim();
          if (!attr || !key) return;
          var v = t(key);
          if (typeof v === 'string') node.setAttribute(attr, v);
        });
      })(attrs[k]);
    }
    var tpl = root.querySelectorAll('[data-i18n-tpl]');
    for (var m = 0; m < tpl.length; m++) {
      tpl[m].innerHTML = t(tpl[m].getAttribute('data-i18n-tpl'), {
        site: cfg().siteName || 'PrePortal',
        year: new Date().getFullYear()
      });
    }
    var lang = meta();
    d.documentElement.lang = lang.code || current;
    d.documentElement.dir = lang.dir || 'ltr';
  }

  /* Dinleyiciler hazır olana kadar biriken kuyruk (senkron diller arası geçiş) */
  var QUEUE = [];
  var flushing = false;
  var bootReady = null;   /* ilk dil yüklendiğinde çözülür */

  function notify(code) {
    var evt = { code: code, meta: meta(), dict: dict, t: t };
    QUEUE.push(evt);
    flush();
  }

  function flush() {
    if (flushing || !QUEUE.length) return;
    flushing = true;
    try {
      while (QUEUE.length) {
        var e = QUEUE.shift();
        try {
          d.dispatchEvent(new CustomEvent('preportal:lang', { detail: e }));
        } catch (err) { /* bir dinleyici patlarsa diğerleri çalışsın */ }
        try {
          w.dispatchEvent(new CustomEvent('preportal:lang', { detail: e }));
        } catch (err2) { /* yoksay */ }
      }
    } finally {
      flushing = false;
    }
  }

  function setLang(code, opts) {
    opts = opts || {};
    if (available().indexOf(code) === -1) code = cfg().defaultLang || FALLBACK;
    return Promise.all([fetchLang(FALLBACK), fetchLang(code)]).then(function (res) {
      current = code;
      dict = res[1];
      try { localStorage.setItem(LS_KEY, code); } catch (e) {}
      apply();
      notify(code);
      return code;
    });
  }

  function formatDate(iso, o) {
    var dt = iso instanceof Date ? iso : new Date(iso);
    if (isNaN(dt)) return '';
    var opts = Object.assign({ year: 'numeric', month: 'long', day: 'numeric' }, o || {});
    try {
      return new Intl.DateTimeFormat(meta().intl || current, opts).format(dt);
    } catch (e) {
      return dt.toLocaleDateString();
    }
  }

  function formatTime(dt, o) {
    dt = dt instanceof Date ? dt : new Date(dt);
    if (isNaN(dt)) return '';
    try {
      return new Intl.DateTimeFormat(meta().intl || current, Object.assign({ hour: '2-digit', minute: '2-digit' }, o || {})).format(dt);
    } catch (e) {
      return dt.toLocaleTimeString();
    }
  }

  function formatDateTime(dt, o) {
    dt = dt instanceof Date ? dt : new Date(dt);
    if (isNaN(dt)) return '';
    try {
      return new Intl.DateTimeFormat(meta().intl || current, Object.assign({ dateStyle: 'medium', timeStyle: 'short' }, o || {})).format(dt);
    } catch (e) {
      return dt.toLocaleString();
    }
  }

  function formatNumber(n) {
    try {
      return new Intl.NumberFormat(meta().intl || current).format(Number(n) || 0);
    } catch (e) {
      return String(n);
    }
  }

  /**
   * Bir sayfanın yeniden çizimini güvenle kaydeder.
   * - Aynı fonksiyon iki kez eklenmez (yeniden çizimde dinleyici çoğalmaz)
   * - Dinleyici hata verirse diğer sayfalar etkilenmez
   * - Kayıt anında dil zaten değişmişse bir kez hemen çalışır
   */
  function onLangChange(fn) {
    if (typeof fn !== 'function') return fn;
    if (fn.__ppLangBound) return fn;
    fn.__ppLangBound = true;
    d.addEventListener('preportal:lang', function () {
      try { fn(w.PP_I18N.current()); } catch (e) { /* yoksay */ }
    });
    return fn;
  }

  /** Sayfalar bunu bekleyerek ilk çizimini doğru dilde yapar */
  function whenReady() {
    if (bootReady) return bootReady;
    bootReady = (current && dict && Object.keys(dict).length)
      ? Promise.resolve(current)
      : setLang(detect());
    return bootReady;
  }

  w.PP_I18N = {
    init: function () { return setLang(detect()); },
    whenReady: whenReady,
    onLangChange: onLangChange,
    setLang: setLang,
    t: t,
    dict: function () { return dict; },
    meta: meta,
    apply: apply,
    detect: detect,
    available: available,
    formatDate: formatDate,
    formatTime: formatTime,
    formatDateTime: formatDateTime,
    formatNumber: formatNumber,
    current: function () { return current; }
  };
})(window, document);

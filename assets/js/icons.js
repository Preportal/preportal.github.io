/* =====================================================================
   PrePortal — ikon motoru (tek kaynak)
   ---------------------------------------------------------------------
   Sorun: kategori ikonu düzeltiliyor ama sitede değişmiyordu.
   Nedenleri ve çözümleri:
   1) İkon adları core.js içinde gömülüydü (ICONS sözlüğü) → artık adlar
      assets/icons/catalog.js dosyasından, yani assets/icons/ klasöründeki
      gerçek SVG dosyalarından gelir. Elle liste YOK.
   2) catalog.js ve bu dosya ?v=<sürüm> ile yüklenir → tarayıcı/service
      worker önbelleği eski ikonu tutamaz.
   3) SVG'ler <img> ile değil, sayfaya gömülerek (inline) çizilir; böylece
      renk temadan gelir ve yükleme hatası sessizce boş kutu bırakmaz.

   Kullanım:
     P.icon('folder', 18)               → <svg class="icon" …>
     P.icon('tabler:folder', 18)        → set seçerek
     P.icon('tabler:filled/folder', 18) → set + stil
     P.icon('folder-filled', 18)        → dolu (filled) varyant
     P.iconURL('folder')                → assets/icons/…/folder.svg
     P.iconNames() / P.searchIcons('fold') / P.iconGroups()
   ===================================================================== */
(function () {
  'use strict';

  var global = window;

  /* ------------------------------------------------------------------ */
  /* 1. katalog                                                          */
  /*    Yeni ikon eklemek: SVG dosyasını assets/icons/ altına koyun,     */
  /*    sonra "node tools/build-icons.js" çalıştırın.                    */
  /* ------------------------------------------------------------------ */
  var RAW = global.PREPORTAL_ICON_CATALOG || null;

  /* Katalog hiç yoksa arayüz bozulmasın: yerleşik çizimler. */
  var FALLBACK = {
    folder: '<path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2"/>',
    book: '<path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6v13M12 6v13M21 6v13"/>',
    check: '<path d="M5 12l5 5l10 -10"/>',
    code: '<path d="M7 8l-4 4l4 4"/><path d="M17 8l4 4l-4 4"/><path d="M14 4l-4 16"/>',
    download: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4v12"/>',
    eye: '<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"/>',
    clock: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 7v5l3 3"/>',
    search: '<path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/><path d="M21 21l-6 -6"/>',
    x: '<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>',
    plus: '<path d="M12 5l0 14"/><path d="M5 12l14 0"/>',
    star: '<path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z"/>',
    heart: '<path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"/>',
    bolt: '<path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11"/>',
    link: '<path d="M9 15l6 -6"/><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464"/><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463"/>',
    user: '<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/>',
    trash: '<path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
    copy: '<path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z"/><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"/>',
    'chevron-down': '<path d="M6 9l6 6l6 -6"/>',
    'arrow-left': '<path d="M5 12l14 0"/><path d="M5 12l6 6"/><path d="M5 12l6 -6"/>',
    'arrow-right': '<path d="M5 12l14 0"/><path d="M13 18l6 -6"/><path d="M13 6l6 6"/>',
    'menu-2': '<path d="M4 6l16 0"/><path d="M4 12l16 0"/><path d="M4 18l16 0"/>',
    apps: '<path d="M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M14 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M14 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/>'
  };

  function noop() { }
  function warn(msg) {
    try { if (global.console && console.warn) console.warn('[PrePortal icons] ' + msg); } catch (e) { noop(); }
  }
  function arr(v) { return Array.isArray(v) ? v.slice() : []; }

  var CAT = { sets: {}, styles: [], aliases: {}, styleAliases: {}, tags: {}, groups: {}, meta: {} };

  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return;
    var sets = raw.sets || {};
    Object.keys(sets).forEach(function (setName) {
      var set = sets[setName];
      if (!set || typeof set !== 'object') return;
      CAT.sets[setName] = {};
      Object.keys(set).forEach(function (styleName) {
        var list = arr(set[styleName]).map(String);
        CAT.sets[setName][styleName] = list;
        if (CAT.styles.indexOf(styleName) === -1) CAT.styles.push(styleName);
      });
    });
    CAT.aliases = (raw.aliases && typeof raw.aliases === 'object') ? raw.aliases : {};
    CAT.styleAliases = (raw.styleAliases && typeof raw.styleAliases === 'object') ? raw.styleAliases : {};
    CAT.tags = (raw.tags && typeof raw.tags === 'object') ? raw.tags : {};
    CAT.groups = (raw.groups && typeof raw.groups === 'object') ? raw.groups : {};
    CAT.meta = (raw.meta && typeof raw.meta === 'object') ? raw.meta : {};
  }
  normalize(RAW);

  /* ad → { set, style, name } hızlı çözümleme tablosu */
  var INDEX = Object.create(null);
  function indexAll() {
    Object.keys(CAT.sets).forEach(function (setName) {
      Object.keys(CAT.sets[setName]).forEach(function (styleName) {
        (CAT.sets[setName][styleName] || []).forEach(function (n) {
          if (!INDEX[n]) INDEX[n] = { set: setName, style: styleName, name: n };
        });
      });
    });
  }
  indexAll();

  function defaultSet() {
    if (CAT.meta.defaultSet && CAT.sets[CAT.meta.defaultSet]) return CAT.meta.defaultSet;
    if (CAT.sets.tabler) return 'tabler';
    var keys = Object.keys(CAT.sets);
    return keys.length ? keys[0] : '';
  }
  function defaultStyle(setName) {
    var styles = Object.keys(CAT.sets[setName] || {});
    if (CAT.meta.defaultStyle && styles.indexOf(CAT.meta.defaultStyle) !== -1) return CAT.meta.defaultStyle;
    if (styles.indexOf('outline') !== -1) return 'outline';
    return styles.length ? styles[0] : '';
  }

  /** Sette gerçekten olan stiller (lucide gibi tek stilli setlerde 'outline') */
  function styleFor(setName, wanted) {
    var styles = Object.keys(CAT.sets[setName] || {});
    if (wanted && styles.indexOf(wanted) !== -1) return wanted;
    return defaultStyle(setName);
  }

  function has(setName, styleName, name) {
    return !!(CAT.sets[setName] && CAT.sets[setName][styleName] &&
      CAT.sets[setName][styleName].indexOf(name) !== -1);
  }

  /** "tabler:filled/folder", "folder-filled", "folder" → { set, style, name } */
  function resolve(name) {
    var raw = String(name == null ? '' : name).trim();
    if (!raw) return null;
    var set = '', style = '', bare = raw;

    var colon = bare.indexOf(':');
    if (colon !== -1) {
      set = bare.slice(0, colon);
      bare = bare.slice(colon + 1);
      var slash = bare.indexOf('/');
      if (slash !== -1) { style = bare.slice(0, slash); bare = bare.slice(slash + 1); }
    }
    if (style && CAT.styleAliases[style]) style = CAT.styleAliases[style];

    if (/-filled$/.test(bare) && !style) { style = 'filled'; bare = bare.slice(0, -7); }
    bare = bare.replace(/\.svg$/i, '');
    /* "filled/folder" → stil ayrıldı, ad "folder" */
    if (/^filled\//.test(bare)) { style = 'filled'; bare = bare.slice(7); }

    /* takma ad (eski adlar: grid → apps gibi) */
    if (!has(defaultSet(), defaultStyle(defaultSet()), bare) && CAT.aliases[bare]) bare = CAT.aliases[bare];

    /* tam eşleşme: set/stil belirtilmişse onu koru */
    if (set && has(set, styleFor(set, style), bare)) {
      return { set: set, style: styleFor(set, style), name: bare };
    }
    /* herhangi bir sette var mı? */
    if (INDEX[bare]) {
      var hit = INDEX[bare];
      if (style && has(hit.set, style, bare)) return { set: hit.set, style: style, name: bare };
      /* stil yoksa setin varsayılan stiline düş */
      if (style && has(hit.set, defaultStyle(hit.set), bare)) return { set: hit.set, style: defaultStyle(hit.set), name: bare };
      return { set: hit.set, style: hit.style, name: bare };
    }
    var s2 = set || defaultSet();
    return { set: s2, style: styleFor(s2, style), name: bare };
  }

  /* ------------------------------------------------------------------ */
  /* 2. çizim                                                            */
  /* ------------------------------------------------------------------ */
  var cache = Object.create(null);

  /** Klasör adı: katalogdaki set adı → diskteki gerçek klasör (tabler → tabler-icons) */
  var DIR_ALIASES = { tabler: ['tabler-icons', 'tabler'], lucide: ['lucide'] };

  function setDirs(setName) {
    return DIR_ALIASES[setName] || [setName];
  }

  /** İkon dosyasının aday yolları (set yapısı farklı olabilir: lucide/icons/) */
  function candidates(r) {
    var cfg = global.PREPORTAL_CONFIG || {};
    var base = String(cfg.iconDir || 'assets/icons').replace(/\/+$/, '');
    var out = [];
    setDirs(r.set).forEach(function (dir) {
      if (r.set === 'lucide') {
        out.push(base + '/' + dir + '/icons/' + r.name + '.svg');
        out.push(base + '/' + dir + '/' + r.name + '.svg');
      } else {
        out.push(base + '/' + dir + '/' + r.style + '/' + r.name + '.svg');
        out.push(base + '/' + dir + '/' + r.name + '.svg');
      }
    });
    return out;
  }

  function readSVG(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false); /* senkron: ikonlar ilk çizimde hazır olsun */
      xhr.send(null);
      if (xhr.status !== 200 && xhr.status !== 0) return '';
      var text = xhr.responseText || '';
      var body = text.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>[\s\S]*$/i, '');
      return body.replace(/<!--[\s\S]*?-->/g, '').trim();
    } catch (e) { return ''; }
  }

  function pathsOf(name) {
    var r = (name && typeof name === 'object' && name.name) ? name : resolve(name);
    if (!r) return '';
    var key = r.set + ':' + r.style + '/' + r.name;
    if (cache[key] != null) return cache[key];

    var out = '';
    var urls = candidates(r);
    for (var i = 0; i < urls.length && !out; i++) out = readSVG(urls[i]);

    if (!out) {
      /* dosya yok: en yakın bilinen ad ya da yalın yedek çizim */
      out = FALLBACK[r.name] || FALLBACK.folder;
      if (CAT.sets[r.set]) warn('could not load "' + urls[0] + '" — fallback used');
    }
    cache[key] = out;
    return out;
  }

  function iconURL(name) {
    var r = (name && typeof name === 'object' && name.name) ? name : resolve(String(name == null ? '' : name));
    if (!r) return '';
    var cfg = global.PREPORTAL_CONFIG || {};
    var base = String(cfg.iconDir || 'assets/icons').replace(/\/+$/, '');
    return candidates(r)[0];
  }

  /** SVG çizer. Renk: currentColor (CSS'ten), boyut: size (px). */
  function icon(name, size) {
    var s = Number(size) || 18;
    var r = resolve(name);
    var filled = !!r && r.style === 'filled';
    var cls = 'icon' + (r ? ' icon--' + r.set + (filled ? ' icon--filled' : '') : '');
    return '<svg class="' + cls + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" ' +
      'fill="' + (filled ? 'currentColor' : 'none') + '" stroke="' + (filled ? 'none' : 'currentColor') + '" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      pathsOf(r) + '</svg>';
  }

  /* ------------------------------------------------------------------ */
  /* 3. sorgular (editör/arama için)                                     */
  /* ------------------------------------------------------------------ */
  function iconNames() { return Object.keys(INDEX).sort(); }

  function iconSets() {
    var out = {};
    Object.keys(CAT.sets).forEach(function (s) { out[s] = Object.keys(CAT.sets[s]); });
    return out;
  }

  function iconsIn(setName, styleName) {
    var s = CAT.sets[setName] || {};
    return (s[styleName || defaultStyle(setName)] || []).slice();
  }

  function iconGroups() { return CAT.groups; }

  function iconTags(name) {
    var r = resolve(name);
    return (r && CAT.tags[r.name]) ? CAT.tags[r.name].slice() : [];
  }

  function searchIcons(query, limit) {
    var q = String(query || '').trim().toLowerCase();
    var names = iconNames();
    if (!q) return names.slice(0, limit || 240);
    var out = names.filter(function (n) {
      if (n.indexOf(q) !== -1) return true;
      var t = CAT.tags[n];
      return !!(t && t.some(function (tag) { return tag.indexOf(q) !== -1; }));
    });
    out.sort(function (a, b) {
      var ia = a.indexOf(q) === 0 ? 0 : 1, ib = b.indexOf(q) === 0 ? 0 : 1;
      return ia - ib || a.localeCompare(b);
    });
    return out.slice(0, limit || 240);
  }

  function iconMeta(name) {
    var r = resolve(name);
    if (!r) return null;
    return { name: r.name, set: r.set, style: r.style, url: iconURL(r), known: has(r.set, r.style, r.name) };
  }

  function isKnown(name) {
    var r = resolve(name);
    return !!(r && has(r.set, r.style, r.name));
  }

  /* ------------------------------------------------------------------ */
  /* 4. dışa açılan API                                                  */
  /* ------------------------------------------------------------------ */
  var API = {
    icon: icon,
    resolve: resolve,
    isKnown: isKnown,
    has: isKnown,
    iconURL: iconURL,
    iconNames: iconNames,
    iconSets: iconSets,
    iconsIn: iconsIn,
    iconGroups: iconGroups,
    iconTags: iconTags,
    searchIcons: searchIcons,
    iconMeta: iconMeta,
    defaultSet: defaultSet,
    defaultStyle: defaultStyle,
    version: CAT.meta.version || 'dev',
    ready: !!RAW
  };

  global.PrePortalIcons = API;

  if (!global.PrePortal) global.PrePortal = {};
  global.PrePortal.icon = icon;
  global.PrePortal.resolveIcon = resolve;
  global.PrePortal.iconURL = iconURL;
  global.PrePortal.iconNames = iconNames;
  global.PrePortal.iconSets = iconSets;
  global.PrePortal.iconsIn = iconsIn;
  global.PrePortal.iconGroups = iconGroups;
  global.PrePortal.iconTags = iconTags;
  global.PrePortal.searchIcons = searchIcons;
  global.PrePortal.iconMeta = iconMeta;
  global.PrePortal.isKnownIcon = isKnown;
})();

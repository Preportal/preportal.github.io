/* =====================================================================
   PrePortal — çekirdek (core)
   Statik ama dinamik: tüm içerik p/, users/, category/ klasörlerindeki
   JS dosyalarından okunur. Sunucu gerekmez, GitHub Pages'te çalışır.
   Arayüz metinleri: lang/<code>.json (bkz. assets/js/i18n.js)
   ===================================================================== */
(function () {
  'use strict';

  var CFG = window.PREPORTAL_CONFIG || {};

  /* ---------- çeviri kısayolu ---------- */
  function T(key, vars) {
    return window.PP_I18N ? window.PP_I18N.t(key, vars) : key;
  }
  function langCode() {
    return window.PP_I18N ? window.PP_I18N.meta().intl || window.PP_I18N.current() : 'en';
  }

  /* ---------- depo (registry) ---------- */
  var Store = {
    posts: Object.create(null),
    users: Object.create(null),
    categories: Object.create(null),
    _postList: [],
    _ready: false
  };

  function normPost(p) {
    if (!p || !p.slug) return null;
    var out = Object.assign({}, p);
    out.slug = String(p.slug);
    out.title = p.title || T('common.untitled');
    out.excerpt = p.excerpt || '';
    out.content = p.content || '';
    out.category = p.category || p.categorySlug || 'general';
    out.tags = Array.isArray(p.tags) ? p.tags : (p.tags ? String(p.tags).split(',') : []);
    out.author = p.author || p.authorSlug || 'preportal';
    out.date = p.date || new Date().toISOString();
    out.updated = p.updated || out.date;
    out.cover = p.cover || p.image || '';
    out.featured = !!p.featured;
    out.views = Number(p.views || 0);
    out.downloads = p.downloads || [];
    out.version = p.version || '';
    out.size = p.size || '';
    out.platform = p.platform || '';
    out.rating = p.rating == null ? null : Number(p.rating);
    return out;
  }

  function normUser(u) {
    if (!u || !u.slug) return null;
    return Object.assign({ name: u.slug, role: '', avatar: '', bio: '', links: {} }, u);
  }

  function normCategory(c) {
    if (!c || !c.slug) return null;
    return Object.assign({ name: c.slug, description: '', icon: 'folder' }, c);
  }

  window.PREPORTAL_POST = {
    register: function (p) {
      var n = normPost(p);
      if (!n) return;
      Store.posts[n.slug] = n;
      if (Store._postList.indexOf(n.slug) === -1) Store._postList.push(n.slug);
    }
  };
  window.PREPORTAL_USER = {
    register: function (u) {
      var n = normUser(u);
      if (n) Store.users[n.slug] = n;
    }
  };
  window.PREPORTAL_CATEGORY = {
    register: function (c) {
      var n = normCategory(c);
      if (n) Store.categories[n.slug] = n;
    }
  };

  /* ---------- yardımcılar ---------- */
  function base() {
    var u = CFG.siteUrl || './';
    return u.charAt(u.length - 1) === '/' ? u : u + '/';
  }

  function loadScript(src) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function () { resolve(true); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
  }

  /* ---------- içerik listeleri ----------
   * Tamamı tarayıcıda, sunucusuz. Öncelik:
   *   1. PrePortalEngine (assets/js/engine.js) — p/ klasörünü kendi keşfeder
   *   2. p/index.js → window.PREPORTAL_POSTS (yazı listesi)
   * Kategori ve yazarlar sabit klasörlerdir; motor category/ ve users/
   * dosyalarını kendi listeler.
   * Elle dizin güncellemek GEREKMEZ.
   */
  function engine() {
    return window.PrePortalEngine || null;
  }

  function manifestList(name) {
    var eng = engine();
    if (name === 'posts') {
      if (eng && eng.isReady && eng.isReady()) {
        var slugs = eng.slugs();
        if (Array.isArray(slugs)) return slugs;
      }
      return window.PREPORTAL_POSTS || [];
    }
    if (eng && eng.dirList) {
      var list = eng.dirList(name);
      if (list && list.length) return list;
    }
    return [];
  }

  function loadList(name, dir) {
    var ids = manifestList(name);
    var jobs = ids.map(function (id) { return loadScript(dir + '/' + id + '.js'); });
    return Promise.all(jobs);
  }

  async function loadAll() {
    if (Store._ready) return Store;
    Store._ready = true;

    /* kategoriler ve yazarlar önce gelir: yazılar onları adıyla gösterir */
    await Promise.all([
      loadList('categories', CFG.categoryDir || 'category'),
      loadList('users', CFG.usersDir || 'users')
    ]);

    /* yazılar: içerik motoru hazırsa listeyi o verir (keşif + önbellek) */
    var eng = engine();
    if (eng && eng.ready) {
      try { await eng.ready(); } catch (e) { /* yedek listelere düşülür */ }
    }
    await loadList('posts', CFG.postsDir || 'p');

    /* motor listesini core'un kayıt defteriyle eşitle (teşhis için) */
    var eng2 = engine();
    if (eng2 && eng2.syncFromCore) { try { eng2.syncFromCore(); } catch (e) { /* yoksay */ } }
    return Store;
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function stripTags(html) {
    var d = document.createElement('div');
    d.innerHTML = String(html || '');
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function truncate(str, n) {
    str = String(str || '');
    if (str.length <= n) return str;
    return str.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
  }

  function slugify(str) {
    var map = {
      'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
      'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u',
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ж': 'zh', 'з': 'z',
      'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p',
      'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch',
      'ш': 'sh', 'щ': 'sch', 'ы': 'y', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ё': 'e', 'ъ': '', 'ь': ''
    };
    return String(str || '').toLowerCase().replace(/[çğıöşüÇĞİÖŞÜа-яё]/g, function (c) { return map[c] || c; })
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'post';
  }

  function dateObj(d) { return d instanceof Date ? d : new Date(d); }

  function formatDate(d, opts) {
    if (window.PP_I18N) return window.PP_I18N.formatDate(d, opts);
    var date = dateObj(d);
    return isNaN(date) ? '' : date.toLocaleDateString();
  }

  function formatTime(d) {
    return (window.PP_I18N && window.PP_I18N.formatTime) ? window.PP_I18N.formatTime(d) : new Date(d).toLocaleTimeString();
  }

  function formatDateTime(d) {
    return (window.PP_I18N && window.PP_I18N.formatDateTime) ? window.PP_I18N.formatDateTime(d) : new Date(d).toLocaleString();
  }

  function relTime(d) {
    var date = dateObj(d);
    if (isNaN(date)) return '';
    try {
      var rtf = new Intl.RelativeTimeFormat(langCode(), { numeric: 'auto' });
      var diff = (date.getTime() - Date.now()) / 1000;
      var abs = Math.abs(diff);
      if (abs < 60) return rtf.format(Math.round(diff), 'second');
      if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
      if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
      if (abs < 2592000) return rtf.format(Math.round(diff / 86400), 'day');
      if (abs < 31536000) return rtf.format(Math.round(diff / 2592000), 'month');
      return rtf.format(Math.round(diff / 31536000), 'year');
    } catch (e) { return formatDate(date); }
  }

  function readingTime(html) {
    var words = stripTags(html).split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  function num(n) {
    if (window.PP_I18N) return window.PP_I18N.formatNumber(n);
    return String(Number(n) || 0);
  }

  function param(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- içerik sorguları ---------- */
  function allPosts() {
    var list = Object.keys(Store.posts).map(function (k) { return Store.posts[k]; });
    list.sort(function (a, b) { return dateObj(b.date) - dateObj(a.date); });
    return list;
  }

  function publishedPosts() {
    return allPosts().filter(function (p) { return p.status !== 'draft'; });
  }

  function postsByCategory(slug) {
    return publishedPosts().filter(function (p) { return p.category === slug; });
  }

  function postsByAuthor(slug) {
    return publishedPosts().filter(function (p) { return p.author === slug; });
  }

  /** Localised name/description for a category slug, from lang/<code>.json (categoryNames.<slug>) */
  function categoryLabel(slug, field) {
    var dict = (window.PP_I18N && window.PP_I18N.dict) ? window.PP_I18N.dict() : null;
    var entry = dict && dict.categoryNames ? dict.categoryNames[slug] : null;
    if (entry && entry[field]) return entry[field];
    return '';
  }

  function getCategory(slug) {
    var raw = Store.categories[slug] || { slug: slug, name: slug.charAt(0).toUpperCase() + slug.slice(1), description: '', icon: 'folder' };
    var out = Object.assign({}, raw);
    var name = categoryLabel(slug, 'name');
    var desc = categoryLabel(slug, 'description');
    if (name) out.name = name;
    if (desc) out.description = desc;
    return out;
  }

  function getUser(slug) {
    return Store.users[slug] || { slug: slug, name: slug, role: '', avatar: '', bio: '', links: {} };
  }

  function categoriesWithCount() {
    var map = Object.create(null);
    publishedPosts().forEach(function (p) {
      map[p.category] = (map[p.category] || 0) + 1;
    });
    Object.keys(Store.categories).forEach(function (k) { if (!(k in map)) map[k] = 0; });
    var list = Object.keys(map).map(function (k) {
      var c = Object.assign({}, getCategory(k));
      c.count = map[k];
      c.parent = (Store.categories[k] && Store.categories[k].parent) || '';
      c.order = (Store.categories[k] && Store.categories[k].order) || 0;
      return c;
    });
    /* alt kategoriler: üst kategoride toplam yazı sayısı */
    list.forEach(function (c) {
      c.total = c.count + list.filter(function (x) { return x.parent === c.slug; })
        .reduce(function (a, x) { return a + x.count; }, 0);
    });
    list.sort(function (a, b) {
      if (a.order !== b.order) return a.order - b.order;
      return b.total - a.total;
    });
    return list;
  }

  /** Bir kategorinin alt kategorileri */
  function childCategories(slug) {
    return categoriesWithCount().filter(function (c) { return c.parent === slug; });
  }

  function allTags() {
    var map = Object.create(null);
    publishedPosts().forEach(function (p) {
      p.tags.forEach(function (t) {
        t = String(t).trim();
        if (!t) return;
        map[t] = (map[t] || 0) + 1;
      });
    });
    return Object.keys(map).map(function (t) { return { tag: t, count: map[t] }; })
      .sort(function (a, b) { return b.count - a.count; });
  }

  /* ---------- arama ---------- */
  /* Ascii katlama: "İndir" ~ "indir", "офис" ~ "ofis" (kiril benzerleri dahil) */
  var FOLD_MAP = { 'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c', 'â': 'a', 'î': 'i', 'û': 'u', 'ё': 'e', 'й': 'i', 'ц': 'c', 'у': 'u', 'к': 'k', 'е': 'e', 'н': 'n', 'г': 'g', 'ш': 's', 'щ': 's', 'з': 'z', 'х': 'h', 'ъ': '', 'ф': 'f', 'ы': 'i', 'в': 'v', 'а': 'a', 'п': 'p', 'р': 'r', 'о': 'o', 'л': 'l', 'д': 'd', 'ж': 'j', 'э': 'e', 'я': 'a', 'ч': 'c', 'с': 's', 'м': 'm', 'и': 'i', 'т': 't', 'ь': '', 'б': 'b', 'ю': 'u' };

  function fold(str) {
    str = String(str == null ? '' : str);
    try { str = str.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { }
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      out += (ch in FOLD_MAP) ? FOLD_MAP[ch] : ch;
    }
    return out.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /* Kelime önekleri: "ku" → "kur", "kura"… (yazarken öneri için) */
  function prefixes(word, max) {
    var set = [];
    var n = Math.min(word.length, max || 3);
    for (var i = 2; i <= n; i++) set.push(word.slice(0, i));
    return set;
  }

  /** Bir kategorinin üst kategorileri (alt kategori desteği) */
  function ancestorsOf(slug) {
    var out = [], seen = {}, cur = Store.categories[slug];
    while (cur && cur.parent && !seen[cur.parent]) {
      seen[cur.parent] = 1;
      out.push(fold(cur.parent));
      var nm = getCategory(cur.parent).name;
      if (nm) out.push(fold(nm));
      cur = Store.categories[cur.parent];
    }
    return out.filter(Boolean);
  }

  /* Yayında olan yazıların arama dizini (bir kez kurulur) */
  var INDEX = null, INDEX_LANG = '';
  function indexBuild() {
    var lang = (window.PP_I18N && window.PP_I18N.current()) || '';
    if (INDEX && INDEX_LANG === lang) return INDEX;
    INDEX = publishedPosts().map(function (p) {
      var cat = getCategory(p.category);
      var author = getUser(p.author);
      var keys = postKeywords(p);
      var body = stripTags(p.content || '');
      return {
        post: p,
        title: fold(p.title),
        excerpt: fold(p.excerpt || ''),
        body: fold(body),
        tags: fold((p.tags || []).join(' ')),
        cat: fold(cat.name + (cat.parent ? ' ' + (getCategory(cat.parent).name || '') : '')),
        author: fold(author.name),
        kw: fold(keys.join(' ')),
        kwList: keys.map(fold),
        ancestors: ancestorsOf(p.category)
      };
    });
    INDEX_LANG = lang;
    return INDEX;
  }
  function searchIndexReset() { INDEX = null; }

  /* Her terim için ağırlıklı puan; kelime öneki de eşleşir ("ku" → "kurmak") */
  function searchScore(entry, terms) {
    var score = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      var hit = 0;
      if (entry.title.indexOf(t) === 0) hit += 60;
      else if ((' ' + entry.title).indexOf(' ' + t) !== -1) hit += 42;
      else if (entry.title.indexOf(t) !== -1) hit += 26;

      if (entry.kwList.some(function (k) { return k.indexOf(t) === 0 || (' ' + k).indexOf(' ' + t) !== -1; })) hit += 24;
      if ((' ' + entry.tags).indexOf(' ' + t) !== -1) hit += 14;
      if ((' ' + entry.cat).indexOf(' ' + t) !== -1) hit += 10;
      if (entry.ancestors.indexOf(t) !== -1) hit += 9;
      if (entry.excerpt.indexOf(t) !== -1) hit += 8;
      if (entry.body.indexOf(t) !== -1) hit += 4;
      if ((' ' + entry.author).indexOf(' ' + t) !== -1) hit += 3;

      /* kelime öneki: "kurm" → "kurmak" */
      if (!hit && t.length >= 3) {
        var pre = t.slice(0, 3);
        if ((' ' + entry.title).indexOf(' ' + pre) !== -1) hit += 9;
        else if (entry.kwList.some(function (k) { return k.indexOf(pre) !== -1; })) hit += 6;
        else if (entry.body.indexOf(t) !== -1) hit += 2;
      }
      score += hit;
    }
    return score;
  }

  function searchPosts(q) {
    var raw = String(q || '').trim();
    if (!raw) return publishedPosts();
    var terms = fold(raw).split(' ').filter(Boolean);
    if (!terms.length) return publishedPosts();
    var idx = indexBuild();
    var scored = [];
    for (var i = 0; i < idx.length; i++) {
      var s = searchScore(idx[i], terms);
      if (s > 0) scored.push({ post: idx[i].post, s: s });
    }
    scored.sort(function (a, b) { return b.s - a.s || dateObj(b.post.date) - dateObj(a.post.date); });
    return scored.map(function (x) { return x.post; });
  }

  /* ---------- anahtar kelimeler (gizli, SEO) ---------- */
  /* post.keywords: dizi veya virgülle ayrılmış metin — sayfada HİÇ gösterilmez */
  function postKeywords(post) {
    if (!post) return [];
    var raw = post.keywords;
    if (!raw) return [];
    var arr = Array.isArray(raw) ? raw : String(raw).split(/\r?\n|,/);
    var seen = {}, out = [];
    arr.forEach(function (k) {
      k = String(k || '').replace(/\s+/g, ' ').trim();
      if (!k) return;
      var key = fold(k);
      if (!key || seen[key]) return;
      seen[key] = 1;
      out.push(k);
    });
    return out;
  }

  /* SEO: <meta name="keywords"> + Article şemasına keywords */
  function applySeoKeywords(post) {
    var keys = postKeywords(post);
    var head = document.head;
    var meta = head.querySelector('meta[name="keywords"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'keywords');
      head.appendChild(meta);
    }
    if (keys.length) meta.setAttribute('content', keys.slice(0, 120).join(', '));
    else meta.parentNode && meta.parentNode.removeChild(meta);
    injectSchema(post, keys);
  }

  /* Article + Breadcrumb JSON-LD (ana sayfa/arşiv için: Website) */
  function injectSchema(post, keys) {
    ['#pp-jsonld'].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) el.parentNode.removeChild(el);
    });
    var site = base();
    var data;
    if (post) {
      var cat = getCategory(post.category);
      var author = getUser(post.author);
      data = {
        '@context': 'https://schema.org',
        '@graph': [{
          '@type': 'Article',
          headline: post.title,
          description: (post.excerpt || truncate(stripTags(post.content || ''), 155)),
          image: post.cover ? new URL(post.cover, site).href : new URL(CFG.logo || 'assets/img/logo-256.png', site).href,
          datePublished: post.date,
          dateModified: post.updated || post.date,
          author: { '@type': 'Person', name: author.name },
          publisher: { '@type': 'Organization', name: CFG.siteName || 'PrePortal', logo: { '@type': 'ImageObject', url: new URL(CFG.logo || 'assets/img/logo-256.png', site).href } },
          mainEntityOfPage: { '@type': 'WebPage', '@id': site + 'post.html?slug=' + encodeURIComponent(post.slug) },
          articleSection: cat.name,
          inLanguage: (window.PP_I18N && window.PP_I18N.current()) || CFG.defaultLang,
          keywords: keys.length ? keys : undefined,
          wordCount: stripTags(post.content || '').split(/\s+/).filter(Boolean).length
        }, {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: CFG.siteName || 'PrePortal', item: site },
            { '@type': 'ListItem', position: 2, name: cat.name, item: site + 'category.html?cat=' + encodeURIComponent(post.category) },
            { '@type': 'ListItem', position: 3, name: post.title }
          ]
        }]
      };
    } else {
      data = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: CFG.siteName || 'PrePortal',
        url: site,
        description: CFG.description || '',
        inLanguage: (window.PP_I18N && window.PP_I18N.current()) || CFG.defaultLang,
        potentialAction: { '@type': 'SearchAction', target: site + 'blog.html?q={q}', 'query-input': 'required name=q' }
      };
    }
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = 'pp-jsonld';
    s.textContent = JSON.stringify(data, null, 2);
    document.head.appendChild(s);
  }

  /* Full-site search manifest (built by the engine at runtime) — for SEO / external search */
  function searchManifest() {
    return publishedPosts().map(function (p) {
      var cat = getCategory(p.category);
      return {
        slug: p.slug,
        title: p.title,
        url: 'post.html?slug=' + encodeURIComponent(p.slug),
        category: p.category,
        categoryName: cat.name,
        excerpt: p.excerpt || truncate(stripTags(p.content || ''), 160),
        tags: p.tags || [],
        keywords: postKeywords(p),
        date: p.date
      };
    });
  }

  function relatedPosts(post, limit) {
    limit = limit || 3;
    var list = publishedPosts().filter(function (p) { return p.slug !== post.slug; });
    return list.map(function (p) {
      var score = 0;
      if (p.category === post.category) score += 3;
      post.tags.forEach(function (t) { if (p.tags.indexOf(t) !== -1) score += 2; });
      return { p: p, s: score };
    }).sort(function (a, b) { return b.s - a.s || dateObj(b.p.date) - dateObj(a.p.date); })
      .slice(0, limit).map(function (x) { return x.p; });
  }

  function adjacentPosts(post) {
    var list = publishedPosts();
    var i = list.findIndex(function (p) { return p.slug === post.slug; });
    return {
      prev: i > 0 ? list[i - 1] : null,
      next: i > -1 && i < list.length - 1 ? list[i + 1] : null
    };
  }

  /* ---------- dosya indirme (client-side) ---------- */
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: (mime || 'text/javascript') + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 800);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* fallthrough */ }
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e2) { return false; }
  }

  /* ---------- bildirim ---------- */
  function toast(msg, type) {
    var host = qs('#toastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toastHost';
      host.className = 'toast-host';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    var el = document.createElement('div');
    el.className = 'toast toast--' + (type || 'info');
    el.innerHTML = '<span class="toast__dot"></span><span class="toast__msg"></span>';
    qs('.toast__msg', el).textContent = msg;
    host.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-in'); });
    setTimeout(function () {
      el.classList.remove('is-in');
      setTimeout(function () { el.remove(); }, 260);
    }, 3400);
  }

  /* ---------- tema ---------- */
  var Theme = {
    key: 'preportal:theme',
    get: function () {
      try { return localStorage.getItem(this.key) || (CFG.theme && CFG.theme.defaultMode) || 'dark'; }
      catch (e) { return 'dark'; }
    },
    resolved: function (mode) {
      mode = mode || this.get();
      if (mode === 'system') {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      }
      return mode === 'light' ? 'light' : 'dark';
    },
    apply: function (mode) {
      var r = this.resolved(mode);
      document.documentElement.setAttribute('data-theme', r);
      document.documentElement.setAttribute('data-theme-mode', mode || this.get());
      var meta = qs('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', r === 'light' ? '#f4f6fb' : '#070b18');
      qsa('[data-theme-toggle]').forEach(function (b) {
        b.setAttribute('aria-pressed', r === 'light' ? 'true' : 'false');
        var t = qs('[data-theme-label]', b);
        if (t) t.textContent = T(r === 'light' ? 'theme.light' : 'theme.dark');
        var use = qs('use', b);
        if (use) use.setAttribute('href', r === 'light' ? '#i-sun' : '#i-moon');
      });
    },
    set: function (mode) {
      try { localStorage.setItem(this.key, mode); } catch (e) { }
      this.apply(mode);
    },
    toggle: function () {
      this.set(this.resolved() === 'light' ? 'dark' : 'light');
    },
    init: function () {
      this.apply(this.get());
      var self = this;
      qsa('[data-theme-toggle]').forEach(function (b) {
        b.addEventListener('click', function () { self.toggle(); });
      });
      if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () {
          if (self.get() === 'system') self.apply('system');
        });
      }
    }
  };

  /* ---------- Fancybox (yerel, gerektiğinde yüklenir) ---------- */
  var fancyPromise = null;
  function loadFancybox() {
    if (window.Fancybox) return Promise.resolve(true);
    if (fancyPromise) return fancyPromise;
    fancyPromise = new Promise(function (resolve) {
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'vendor/fancybox/fancybox.css';
      document.head.appendChild(css);
      var code = window.PP_I18N ? window.PP_I18N.current() : 'en';
      var s1 = document.createElement('script');
      s1.src = 'vendor/fancybox/' + (code === 'tr' ? 'tr_TR' : code === 'ru' ? 'ru_RU' : 'en_EN') + '.umd.js';
      s1.onload = function () {
        var s2 = document.createElement('script');
        s2.src = 'vendor/fancybox/fancybox.umd.js';
        s2.onload = function () { resolve(true); };
        s2.onerror = function () { resolve(false); };
        document.head.appendChild(s2);
      };
      s1.onerror = function () { resolve(false); };
      document.head.appendChild(s1);
    });
    return fancyPromise;
  }

  function initFancybox(scope) {
    if (!window.Fancybox) {
      loadFancybox().then(function (ok) { if (ok) initFancybox(scope); });
      return;
    }
    var root = scope || document;
    if (!root.querySelectorAll('[data-fancybox]').length) return;
    try { window.Fancybox.bind('[data-fancybox]', {}); } catch (e) { }
  }

  /* ---------- Disqus (her yazı için ayrı konu) ---------- */
  var disqusState = { slug: '', loaded: false };
  var DISQUS_ERRORS = /(we were unable to load disqus|не удалось загрузить|disqus is not|not configured for this site)/i;

  function disqusConfig() {
    var d = CFG.disqus || {};
    return {
      shortname: String(d.shortname || '').trim().replace(/\.disqus\.com.*$/i, ''),
      mode: d.pageIdentifier === 'slug' ? 'slug' : 'url'
    };
  }

  /** Yazıya özgü konu kimliği: yazar, site adresi değişse de yorumlar yerinde kalır */
  function disqusId(post) {
    return 'preportal-article-' + post.slug;
  }

  function disqusThreadUrl(post) {
    return base() + 'post.html?slug=' + encodeURIComponent(post.slug);
  }

  /**
   * Disqus'u sayfaya bağlar.
   * opts: { theme, title, force }  — dil değişince aynı konu yeniden bağlanır.
   */
  function mountDisqus(post, hostEl, opts) {
    if (!hostEl) return;
    opts = opts || {};
    var cfg = disqusConfig();
    var token = String(post.slug) + '|' + (opts.theme || '') + '|' + cfg.shortname;

    if (hostEl.getAttribute('data-disqus-token') === token && disqusState.loaded && !opts.force) return;

    /* temizle */
    hostEl.innerHTML = '';
    hostEl.setAttribute('data-disqus-token', token);
    var old = qs('#disqus_thread_pp');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    try { delete window.DISQUS; delete window.disqus_config; } catch (e) { window.DISQUS = undefined; }
    disqusState.loaded = false;

    if (!cfg.shortname) {
      hostEl.innerHTML = '<div class="comments-empty">' +
        '<strong>' + esc(T('post.commentsNotConfigured')) + '</strong>' +
        '<p>' + esc(T('post.commentsNotConfiguredText')) + '</p></div>';
      return;
    }

    var identifier = cfg.mode === 'slug' ? disqusId(post) : disqusThreadUrl(post);

    var thread = document.createElement('div');
    thread.id = 'disqus_thread_pp';
    hostEl.appendChild(thread);

    /* Disqus yapılandırması: page nesnesi her zaman tanımlı olmalı */
    window.disqus_config = function () {
      var self = this;
      self.page = self.page || {};
      self.page.url = disqusThreadUrl(post);
      self.page.identifier = identifier;
      self.page.title = String(opts.title || post.title).slice(0, 190);
      self.language = (window.PP_I18N && window.PP_I18N.current()) || CFG.defaultLang;
    };

    var s = document.createElement('script');
    s.src = 'https://' + cfg.shortname + '.disqus.com/embed.js';
    s.setAttribute('data-timestamp', String(Date.now()));
    s.async = true;
    s.onload = function () { disqusState.loaded = true; };
    s.onerror = function () { showCommentsError(hostEl, post); };
    document.head.appendChild(s);

    /* yükleme kontrolü: iframe gelmezse/engellenirse bilgi kartı göster */
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var box = qs('#disqus_thread_pp', hostEl);
      if (box) {
        var frame = box.querySelector('iframe');
        if (frame && (frame.offsetHeight > 20 || frame.clientHeight > 20)) { clearInterval(timer); disqusState.loaded = true; return; }
        if (DISQUS_ERRORS.test(box.textContent || '')) { clearInterval(timer); showCommentsError(hostEl, post); return; }
      }
      if (tries > 40) clearInterval(timer);
    }, 250);
  }

  function showCommentsError(hostEl, post) {
    hostEl.innerHTML = '<div class="comments-empty">' +
      '<strong>' + esc(T('post.commentsFailed')) + '</strong>' +
      '<p>' + esc(T('post.commentsFailedText')) + '</p>' +
      '<a class="btn btn--ghost btn--sm" href="' + esc(disqusThreadUrl(post)) + '#disqus_thread" target="_blank" rel="noopener">' +
      esc(T('post.commentsOpen')) + '</a></div>';
  }

  /* ---------- özel kaynaklar (reklam, custom css/js) ---------- */
  var INJECTED = { css: {}, js: {}, ad: {} };

  function injectStyle(id, css) {
    if (!css) return;
    var el = document.getElementById('pp-style-' + id);
    if (!el) {
      el = document.createElement('style');
      el.id = 'pp-style-' + id;
      document.head.appendChild(el);
    }
    el.textContent = css;
  }

  function injectScript(id, code) {
    if (!code) return;
    var old = document.getElementById('pp-script-' + id);
    if (old) old.parentNode.removeChild(old);
    var s = document.createElement('script');
    s.id = 'pp-script-' + id;
    s.textContent = 'try{\n' + code + '\n}catch(e){console.error("[PrePortal custom js]",e);}';
    document.body.appendChild(s);
  }

  /* Reklam slotları: data-ad="header|sidebar|inline|footer" → her eşleşen alana basılır */
  function mountAds(scope) {
    var ads = CFG.ads || {};
    if (!ads.enabled) return;
    var root = scope || document;
    var slots = qsa('[data-ad]', root);
    if (!slots.length) return;
    slots.forEach(function (slot) {
      var key = slot.getAttribute('data-ad');
      var list = Array.isArray(ads.slots) ? ads.slots.filter(function (a) { return a && a.enabled !== false && a.slot === key && a.code; }) : [];
      if (!list.length) { slot.hidden = true; return; }
      slot.hidden = false;
      var html = '';
      list.forEach(function (a) {
        html += '<div class="ad-slot__item" data-ad-id="' + esc(a.id || key) + '">' + a.code + '</div>';
        (a.scripts || []).forEach(function (src, i) {
          html += '<script data-ad-src="' + esc(src) + '" data-ad-id="' + esc((a.id || key) + '-' + i) + '"></script>';
        });
      });
      slot.innerHTML = '<span class="ad-slot__label">' + esc(T('ads.label')) + '</span>' + html;
      /* <template> içindeki <script> çalışmaz: elle yeniden oluştur */
      qsa('script[data-ad-src]', slot).forEach(function (old) {
        var s = document.createElement('script');
        s.src = old.getAttribute('data-ad-src');
        s.async = true;
        s.setAttribute('data-ad-id', old.getAttribute('data-ad-id'));
        old.parentNode.replaceChild(s, old);
      });
    });
  }

  /** config.runtime (data/runtime.js) → özel CSS, özel JS, reklamlar */
  function mountRuntime() {
    var rt = CFG.runtime || {};
    if (rt.customCss) injectStyle('custom', rt.customCss);
    if (rt.headHtml) {
      var holder = document.getElementById('pp-head-html');
      if (!holder) {
        holder = document.createElement('div');
        holder.id = 'pp-head-html';
        holder.style.display = 'none';
        document.head.appendChild(holder);
      }
      holder.innerHTML = rt.headHtml;
    }
    mountAds();
    var js = rt.customJs;
    if (js) listenOnce('load', function () { setTimeout(function () { injectScript('custom', js); }, 0); });
  }

  function listenOnce(evt, fn) {
    if (document.readyState === 'complete' && evt === 'load') return fn();
    window.addEventListener(evt, fn, { once: true });
  }

  /* ---------- ikonlar (SVG sprite) ---------- */
  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    smartphone: '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 18.5h3"/>',
    gamepad: '<path d="M7 8h10a5 5 0 0 1 5 5v.5a3.5 3.5 0 0 1-6.3 2L14 14h-4l-1.7 1.5a3.5 3.5 0 0 1-6.3-2V13a5 5 0 0 1 5-5Z"/><path d="M8 11v2M7 12h2"/><circle cx="16" cy="12" r="1"/>',
    pen: '<path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="M14 6l4 4"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    megaphone: '<path d="M4 10v4l12 5V5L4 10Z"/><path d="M18 9a3 3 0 0 1 0 6"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22V4.5Z"/><path d="M4 17.5h16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    eye: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.8"/>',
    download: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    check: '<path d="m4 12.5 5 5L20 6.5"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"/>',
    tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    upload: '<path d="M12 21V9"/><path d="m7 13 5-5 5 5"/><path d="M4 4h16"/>',
    save: '<path d="M5 3h11l3 3v15H5Z"/><path d="M8 3v6h8V3"/><path d="M8 14h8v7H8Z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 14h10l1-14"/>',
    code: '<path d="m9 8-5 4 5 4"/><path d="m15 8 5 4-5 4"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z"/>',
    sparkle: '<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><path d="m6.5 6.5 3 3M14.5 14.5l3 3M17.5 6.5l-3 3M9.5 14.5l-3 3"/>'
  };

  function icon(name, size) {
    var s = size || 18;
    return '<svg class="icon" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  /* ---------- dil seçici ---------- */
  function langOptions() {
    var avail = window.PP_I18N ? window.PP_I18N.available() : ['en'];
    var cur = window.PP_I18N ? window.PP_I18N.current() : 'en';
    return avail.map(function (code) {
      var label = { en: 'English', tr: 'Türkçe', ru: 'Русский' }[code] || code.toUpperCase();
      return '<button class="lang-menu__item' + (code === cur ? ' is-active' : '') + '" type="button" role="menuitemradio" aria-checked="' + (code === cur) + '" data-lang="' + esc(code) + '">' +
        '<span class="lang-menu__code">' + esc(code.toUpperCase()) + '</span>' +
        '<span class="lang-menu__name">' + esc(label) + '</span>' +
        (code === cur ? icon('check', 15) : '') +
        '</button>';
    }).join('');
  }

  function mountLang() {
    var btn = qs('[data-lang-toggle]');
    if (!btn) return;
    var wrap = btn.closest('.lang');
    var menu = qs('.lang-menu', wrap);
    if (!menu) return;

    function close() {
      wrap.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    }
    function render() {
      menu.innerHTML = '<div class="lang-menu__head">' + esc(T('actions.language')) + '</div>' + langOptions();
    }
    render();
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !wrap.classList.contains('is-open');
      wrap.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) render();
    });
    menu.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lang]');
      if (!b) return;
      var code = b.getAttribute('data-lang');
      close();
      if (!window.PP_I18N) return;
      /* iskelet, core'daki 'preportal:lang' dinleyicisiyle tazelenir */
      window.PP_I18N.setLang(code);
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
    document.addEventListener('preportal:lang', render);
  }

  /* ---------- iskelet (header/footer) ---------- */
  var NAV_ITEMS = [
    { href: 'index.html', key: 'nav.home', icon: 'home' },
    { href: 'category.html', key: 'nav.categories', icon: 'grid' },
    { href: 'apps.html', key: 'nav.apps', icon: 'smartphone' },
    { href: 'games.html', key: 'nav.games', icon: 'gamepad' },
    { href: 'blog.html', key: 'nav.blog', icon: 'pen' },
    { href: 'upload.html', key: 'nav.media', icon: 'upload' }
  ];

  function navHTML() {
    var bodyPage = document.body.getAttribute('data-page') || '';
    return NAV_ITEMS.map(function (it) {
      var key = it.href.replace('.html', '');
      var active = bodyPage === key || (key === 'blog' && bodyPage === 'category');
      return '<a class="nav-link' + (active ? ' is-active' : '') + '" href="' + it.href + '">' + icon(it.icon, 17) + '<span>' + esc(T(it.key)) + '</span></a>';
    }).join('');
  }

  function socialHTML() {
    var soc = CFG.social || {};
    var items = [
      { label: 'Telegram', url: soc.telegram, svg: '<path d="m21 4-2.6 15.2a1 1 0 0 1-1.6.6l-4.3-3.2-2 2.1a1 1 0 0 1-1.7-.6l-.6-3.7-3.6-1.2a1 1 0 0 1 0-1.9L20 3.4a.8.8 0 0 1 1 .6Z"/>' },
      { label: 'X', url: soc.x, svg: '<path d="M4 4l16 16M20 4 4 20"/>' },
      { label: 'GitHub', url: soc.github, svg: '<path d="M9 19c-4 1.5-4-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 4.5-1.4 4.5-4.8 0-1.1-.4-2-1-2.7.1-.3.4-1.3-.1-2.6 0 0-1-.3-3.4 1.4a10 10 0 0 0-5 0C6.8 4.3 5.8 4.6 5.8 4.6c-.5 1.3-.2 2.3-.1 2.6-.6.7-1 1.6-1 2.7 0 3.4 1.7 4.5 4.5 4.8-.5.5-.5 1-.5 1.8V20"/>' },
      { label: 'RSS', url: soc.rss, svg: '<path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.6"/>' }
    ].filter(function (i) { return i.url; });
    if (!items.length) return '';
    return '<div class="footer-social">' + items.map(function (i) {
      return '<a href="' + esc(i.url) + '" target="_blank" rel="noopener" aria-label="' + esc(i.label) + '" title="' + esc(i.label) + '">' +
        '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + i.svg + '</svg></a>';
    }).join('') + '</div>';
  }

  function mountChrome() {
    /* iskelet her dil değişiminde yeniden çizilir; yazı tipi/ölçek aynı kalır */
    var header = qs('[data-header]');
    if (header) {
      var cur = window.PP_I18N ? window.PP_I18N.current().toUpperCase() : 'EN';
      header.innerHTML = [
        '<div class="header-inner">',
        '<a class="brand" href="index.html" aria-label="' + esc(CFG.siteName) + '">',
        '<span class="brand-mark"><img src="' + esc(CFG.logo || 'assets/img/logo.png') + '" alt="" width="34" height="34"></span>',
        '<span class="brand-text"><strong>' + esc(CFG.siteName) + '</strong><small data-i18n="brand.tagline"></small></span>',
        '</a>',
        '<nav class="nav" id="primaryNav" aria-label="' + esc(T('actions.menu')) + '">' + navHTML() + '</nav>',
        '<div class="header-actions">',
        '<button class="icon-btn search-btn" type="button" data-open-search aria-label="' + esc(T('actions.search')) + '" title="' + esc(T('actions.search')) + '">' + icon('search', 19) + '</button>',
        '<div class="lang" data-lang-wrap>',
        '<button class="icon-btn lang-btn" type="button" data-lang-toggle aria-haspopup="true" aria-expanded="false" aria-label="' + esc(T('actions.language')) + '" title="' + esc(T('actions.language')) + '">',
        icon('globe', 19), '<span class="lang-btn__code">' + esc(cur) + '</span>',
        '</button>',
        '<div class="lang-menu" role="menu"></div>',
        '</div>',
        '<a class="btn btn--primary btn--sm header-write" href="create.html">' + icon('pen', 16) + '<span>' + esc(T('actions.write')) + '</span></a>',
        '<button class="icon-btn nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="primaryNav" aria-label="' + esc(T('actions.menu')) + '">' + icon('menu', 20) + '</button>',
        '</div>',
        '</div>'
      ].join('');

      var toggle = qs('[data-nav-toggle]', header);
      if (toggle) toggle.addEventListener('click', function () {
        var open = header.classList.toggle('nav-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    var footer = qs('[data-footer]');
    if (footer) {
      var cats = categoriesWithCount().slice(0, 6).map(function (c) {
        return '<li><a href="category.html?cat=' + encodeURIComponent(c.slug) + '">' + esc(c.name) + '<span>' + c.count + '</span></a></li>';
      }).join('');
      footer.innerHTML = [
        '<div class="footer-inner">',
        '<div class="footer-brand">',
        '<a class="brand" href="index.html"><span class="brand-mark"><img src="' + esc(CFG.logo || 'assets/img/logo.png') + '" alt="" width="30" height="30"></span><span class="brand-text"><strong>' + esc(CFG.siteName) + '</strong></span></a>',
        '<p>' + esc(CFG.description || '') + '</p>',
        '<p class="footer-note">' + icon('code', 15) + ' <span data-i18n="footer.note"></span></p>',
        socialHTML(),
        '</div>',
        '<div class="footer-col"><h4 data-i18n="footer.explore"></h4><ul>',
        '<li><a href="index.html" data-i18n="nav.home"></a></li>',
        '<li><a href="category.html" data-i18n="nav.categories"></a></li>',
        '<li><a href="blog.html" data-i18n="footer.allPosts"></a></li>',
        '<li><a href="apps.html" data-i18n="nav.apps"></a></li>',
        '<li><a href="games.html" data-i18n="nav.games"></a></li>',
        '</ul></div>',
        '<div class="footer-col"><h4 data-i18n="footer.categories"></h4><ul>' + (cats || '<li class="muted" data-i18n="footer.noCategories"></li>') + '</ul></div>',
        '<div class="footer-col"><h4 data-i18n="footer.editor"></h4><ul>',
        '<li><a href="create.html" data-i18n="footer.newPost"></a></li>',
        '<li><a href="edit.html" data-i18n="footer.editPost"></a></li>',
        '<li><a href="create.html?tab=publish" data-i18n="footer.publishTool"></a></li>',
        '<li><a href="upload.html" data-i18n="footer.mediaTool"></a></li>',
        '<li><a href="admin.html" data-i18n="footer.admin"></a></li>',
        '<li><a href="about.html" data-i18n="footer.about"></a></li>',
        '<li><a href="privacy.html" data-i18n="footer.privacy"></a></li>',
        (CFG.social && CFG.social.rss ? '<li><a href="' + esc(CFG.social.rss) + '" data-i18n="footer.rss"></a></li>' : ''),
        '</ul></div>',
        '</div>',
        '<div class="footer-bottom"><span data-i18n-tpl="footer.rights"></span>',
        '<span class="footer-badges"><span class="pill">HTML</span><span class="pill">CSS</span><span class="pill">JavaScript</span></span></div>'
      ].join('');
    }

    if (window.PP_I18N) window.PP_I18N.apply();
    Theme.apply(Theme.get());
    mountLang();
  }

  /* ---------- arama katmanı ---------- */
  function mountSearch(rebuild) {
    var modal = qs('#searchModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'searchModal';
      modal.className = 'search-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = [
        '<div class="search-panel">',
        '<div class="search-field">' + icon('search', 20),
        '<input type="search" id="searchInput" autocomplete="off">',
        '<button class="icon-btn" type="button" data-close-search aria-label="' + esc(T('actions.close')) + '">' + icon('close', 18) + '</button>',
        '</div>',
        '<div class="search-filters" id="searchFilters"></div>',
        '<div class="search-results" id="searchResults"></div>',
        '<div class="search-foot"><kbd>Esc</kbd> <span data-i18n="search.foot"></span></div>',
        '</div>'
      ].join('');
      document.body.appendChild(modal);

      var input = qs('#searchInput', modal);
      var results = qs('#searchResults', modal);
      var filters = qs('#searchFilters', modal);
      var activeCat = '';
      var lastResults = [];

      function renderFilters() {
        var cats = categoriesWithCount();
        filters.innerHTML = ['<button class="chip' + (activeCat === '' ? ' is-active' : '') + '" type="button" data-scat="">' + esc(T('search.all')) + '</button>']
          .concat(cats.map(function (c) {
            return '<button class="chip' + (activeCat === c.slug ? ' is-active' : '') + '" type="button" data-scat="' + esc(c.slug) + '">' + esc(c.name) + '</button>';
          })).join('');
      }

      function render(q) {
        if (!q) {
          lastResults = [];
          results.innerHTML = '<p class="search-hint">' + esc(T('search.hint')) + '</p>';
          return;
        }
        lastResults = searchPosts(q).filter(function (p) { return !activeCat || p.category === activeCat; }).slice(0, 8);
        if (!lastResults.length) {
          results.innerHTML = '<p class="search-hint">' + esc(T('search.noResults', { q: q })) + '</p>';
          return;
        }
        results.innerHTML = lastResults.map(function (p) {
          return '<a class="search-result" href="post.html?slug=' + encodeURIComponent(p.slug) + '">' +
            '<span class="search-result__title">' + esc(p.title) + '</span>' +
            '<span class="search-result__meta">' + esc(getCategory(p.category).name) + ' · ' + esc(formatDate(p.date)) + '</span>' +
            '</a>';
        }).join('');
      }

      filters.addEventListener('click', function (e) {
        var b = e.target.closest('[data-scat]');
        if (!b) return;
        activeCat = b.getAttribute('data-scat');
        renderFilters();
        render(input.value.trim());
      });
      input.addEventListener('input', function () { render(input.value.trim()); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && lastResults.length) {
          location.href = 'post.html?slug=' + encodeURIComponent(lastResults[0].slug);
        }
      });
      modal._renderFilters = renderFilters;
      modal._render = render;
      modal._input = input;
      modal._filters = filters;
      modal._results = results;
    }

    if (rebuild) {
      var inp = modal._input;
      var fl = modal._filters;
      if (inp) inp.setAttribute('placeholder', T('search.placeholder'));
      if (fl && modal._renderFilters) modal._renderFilters();
      if (modal._results && inp) modal._render(inp.value.trim());
      if (window.PP_I18N) window.PP_I18N.apply(modal);
      return;
    }

    var input = modal._input;
    var filters = modal._filters;
    input.setAttribute('placeholder', T('search.placeholder'));
    input.setAttribute('aria-label', T('actions.search'));
    modal.setAttribute('aria-label', T('search.title'));

    function open() {
      if (!filters.childElementCount) modal._renderFilters();
      modal.classList.add('is-open');
      document.body.classList.add('no-scroll');
      setTimeout(function () { input.focus(); }, 30);
    }
    function close() {
      modal.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
    }

    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-open-search]')) { e.preventDefault(); open(); }
      if (e.target.closest('[data-close-search]') || e.target === modal) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName) && !modal.classList.contains('is-open')) {
        e.preventDefault(); open();
      }
    });
  }

  /* ---------- görünürlük animasyonları ---------- */
  function reveal() {
    var els = qsa('[data-reveal]:not(.is-revealed)');
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach(function (el) { el.classList.add('is-revealed'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('is-revealed');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    els.forEach(function (el, i) {
      el.style.setProperty('--reveal-delay', (i % 6) * 55 + 'ms');
      io.observe(el);
    });
  }

  /* ---------- kart şablonları ---------- */
  function postCard(p, variant) {
    var cat = getCategory(p.category);
    var author = getUser(p.author);
    return [
      '<article class="card post-card ' + (variant || '') + '" data-reveal>',
      '<a class="card-media" href="post.html?slug=' + encodeURIComponent(p.slug) + '" aria-label="' + esc(p.title) + '">',
      p.cover ? '<img src="' + esc(p.cover) + '" alt="' + esc(p.title) + '" loading="lazy" decoding="async">' : '<span class="card-media__fallback">' + icon('sparkle', 26) + '</span>',
      '<span class="badge badge--cat">' + esc(cat.name) + '</span>',
      p.featured ? '<span class="badge badge--feat">' + icon('star', 12) + ' ' + esc(T('home.featuredBadge')) + '</span>' : '',
      '</a>',
      '<div class="card-body">',
      '<h3 class="card-title"><a href="post.html?slug=' + encodeURIComponent(p.slug) + '">' + esc(p.title) + '</a></h3>',
      '<p class="card-excerpt">' + esc(truncate(p.excerpt || stripTags(p.content), 120)) + '</p>',
      '<div class="card-meta">',
      '<span class="meta-item">' + icon('user', 14) + esc(author.name) + '</span>',
      '<span class="meta-item">' + icon('clock', 14) + esc(formatDate(p.date)) + '</span>',
      '<span class="meta-item">' + icon('eye', 14) + esc(T('post.readingTime', { n: readingTime(p.content) })) + '</span>',
      '</div>',
      '</div>',
      '</article>'
    ].join('');
  }

  function postRow(p) {
    var cat = getCategory(p.category);
    return [
      '<a class="row-card" href="post.html?slug=' + encodeURIComponent(p.slug) + '" data-reveal>',
      '<span class="row-card__thumb">',
      p.cover ? '<img src="' + esc(p.cover) + '" alt="" loading="lazy" decoding="async">' : '<span class="row-card__fallback">' + icon('sparkle', 20) + '</span>',
      '</span>',
      '<span class="row-card__body">',
      '<span class="row-card__title">' + esc(p.title) + '</span>',
      '<span class="row-card__excerpt">' + esc(truncate(p.excerpt || stripTags(p.content), 110)) + '</span>',
      '<span class="row-card__meta"><span class="badge badge--ghost">' + esc(cat.name) + '</span>' + esc(formatDate(p.date)) + ' · ' + esc(T('post.readingTime', { n: readingTime(p.content) })) + '</span>',
      '</span>',
      '</a>'
    ].join('');
  }

  function emptyState(title, text, action) {
    return '<div class="empty-state" data-reveal>' + icon('sparkle', 28) +
      '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + (action || '') + '</div>';
  }

  /* ---------- içindekiler (TOC) ---------- */
  function buildTOC(container, target) {
    if (!container || !target) return;
    var heads = qsa('h2, h3', container);
    if (heads.length < 2) return;
    heads.forEach(function (h, i) {
      if (!h.id) h.id = slugify(h.textContent) || ('section-' + i);
    });
    target.innerHTML = heads.map(function (h) {
      return '<a href="#' + h.id + '" class="' + (h.tagName === 'H3' ? 'is-h3' : '') + '">' + esc(h.textContent) + '</a>';
    }).join('');
    var links = qsa('a', target);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (l) { l.classList.toggle('is-active', l.getAttribute('href') === '#' + en.target.id); });
        });
      }, { rootMargin: '-20% 0px -70% 0px' });
      heads.forEach(function (h) { io.observe(h); });
    }
  }

  /* ---------- sayfa iskeleti ---------- */
  async function init() {
    Theme.init();
    if (window.PP_I18N) await window.PP_I18N.init();
    await loadAll();
    mountChrome();
    mountSearch();
    mountRuntime();

    /* Dil her değiştiğinde iskelet (menü, arama, altbilgi) anında yenilenir.
     * Sayfa içerikleri kendi 'preportal:lang' dinleyicileriyle çizilir. */
    if (window.PP_I18N && window.PP_I18N.onLangChange) {
      window.PP_I18N.onLangChange(function () {
        mountChrome();
        mountSearch(true);
        if (window.PP_I18N.apply) window.PP_I18N.apply(document);
      });
    }

    document.dispatchEvent(new CustomEvent('preportal:ready'));
    reveal();
  }

  window.PrePortal = {
    CFG: CFG,
    Store: Store,
    t: T,
    ready: init,
    init: init,
    allPosts: allPosts,
    publishedPosts: publishedPosts,
    postsByCategory: postsByCategory,
    postsByAuthor: postsByAuthor,
    categoriesWithCount: categoriesWithCount,
    childCategories: childCategories,
    allTags: allTags,
    getCategory: getCategory,
    getUser: getUser,
    searchPosts: searchPosts,
    searchManifest: searchManifest,
    searchIndexReset: searchIndexReset,
    fold: fold,
    prefixes: prefixes,
    postKeywords: postKeywords,
    applySeoKeywords: applySeoKeywords,
    injectSchema: injectSchema,
    ancestorsOf: ancestorsOf,
    mountRuntime: mountRuntime,
    mountAds: mountAds,
    injectStyle: injectStyle,
    injectScript: injectScript,
    engine: engine,
    manifestList: manifestList,
    disqusId: disqusId,
    disqusThreadUrl: disqusThreadUrl,
    relatedPosts: relatedPosts,
    adjacentPosts: adjacentPosts,
    postCard: postCard,
    postRow: postRow,
    emptyState: emptyState,
    esc: esc,
    stripTags: stripTags,
    truncate: truncate,
    slugify: slugify,
    formatDate: formatDate,
    formatTime: formatTime,
    formatDateTime: formatDateTime,
    relTime: relTime,
    readingTime: readingTime,
    num: num,
    param: param,
    qs: qs,
    qsa: qsa,
    download: download,
    copyText: copyText,
    toast: toast,
    icon: icon,
    Theme: Theme,
    initFancybox: initFancybox,
    mountDisqus: mountDisqus,
    reveal: reveal,
    loadFancybox: loadFancybox,
    buildTOC: buildTOC,
    mountChrome: mountChrome,
    base: base
  };
})();

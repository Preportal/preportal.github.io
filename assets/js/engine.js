/**
 * PrePortal — Content Engine (dynamic, zero-build, browser-only)
 * ===================================================================
 * Discovers every piece of content at runtime by scanning the folder
 * structure: p/ (posts), category/ (categories), users/ (authors).
 *
 * How it works:
 *   - Discovers p/*.js from a local HTTP directory listing or the GitHub tree API.
 *   - Falls back to a cached list, p/index.js, and finally probes.
 *   - Loads category/<slug>.js and users/<slug>.js the same way.
 *   - Builds a full search index, category counts and author index in memory.
 *   - No server, no build step, no manual index files — everything is generated
 *     live in the browser from the files you commit to the repo.
 *
 * Public API — window.PrePortalEngine:
 *   await Engine.ready()                 → all content loaded (returns slugs)
 *   await Engine.refresh()               → re-scan everything from scratch
 *   Engine.sources()                     → which sources were tried / filled
 *   Engine.report()                      → diagnostics object
 *   Engine.posts()                       → array of post objects
 *   Engine.categories()                  → array of category objects with counts
 *   Engine.users()                       → array of user objects
 *   Engine.search(q)                     → fuzzy search across titles + text
 *   Engine.getCategory(slug) / Engine.getUser(slug)
 *   Engine.registerPost(obj)             → register a post at runtime (preview)
 */
(function (global) {
  'use strict';

  var CFG = (global.PREPORTAL_CONFIG || {});
  var POSTS_DIR = CFG.postsDir || 'p';
  var CAT_DIR = CFG.categoryDir || 'category';
  var USERS_DIR = CFG.usersDir || 'users';
  var DATA_DIR = CFG.dataDir || 'data';
  var CACHE_KEY = 'preportal:engine:v2';
  var CACHE_TTL = 1000 * 60 * 60 * 24; /* 24 hours */
  var PROBE_LIMIT = 90;
  var CONCURRENCY = 6;
  var FETCH_TIMEOUT = 6000;

  /* ------------------------------------------------------------------ */
  /* helpers                                                           */
  /* ------------------------------------------------------------------ */

  function isLocalHost() {
    var h = location.hostname || '';
    return location.protocol === 'file:' ||
      h === 'localhost' || h === '127.0.0.1' || h === '[::1]' ||
      h === '0.0.0.0' || /\.local$/.test(h) || h === '';
  }

  function base() {
    // Content is published beside the site's HTML pages.
    return new URL('./', location.href).href;
  }

  function abs(p) {
    try { return new URL(p, new URL(base(), location.href)).href; } catch (e) { return p; }
  }

  function fetchText(url, timeout) {
    timeout = timeout || FETCH_TIMEOUT;
    if (typeof fetch !== 'function') return Promise.resolve(null);
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeout);
    return fetch(url, { cache: 'no-cache', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        clearTimeout(timer);
        return r.ok ? r.text() : null;
      })
      .catch(function () { clearTimeout(timer); return null; });
  }

  function log() {
    if (!global.PREPORTAL_DEBUG) return;
    try { console.log.apply(console, ['[engine]'].concat([].slice.call(arguments))); } catch (e) { /* ignore */ }
  }

  function slugify(s) {
    return String(s || '').toLowerCase().replace(/[^\w\-.]+/g, '-').replace(/^-+|_+$/g, '');
  }

  function stripTags(html) {
    return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function lower(str) {
    return String(str || '').toLowerCase();
  }

  /* ------------------------------------------------------------------ */
  /* state                                                             */
  /* ------------------------------------------------------------------ */

  var state = {
    loaded: false,
    loading: null,
    slugs: [],
    sources: [],
    attempted: Object.create(null),
    cacheUsed: false,
    lastRun: 0
  };

  var registry = {
    posts: Object.create(null),
    categories: Object.create(null),
    users: Object.create(null)
  };

  function ensureRegistries() {
    global.PREPORTAL_POST = global.PREPORTAL_POST || { register: function () {} };
    global.PREPORTAL_CATEGORY = global.PREPORTAL_CATEGORY || { register: function () {} };
    global.PREPORTAL_USER = global.PREPORTAL_USER || { register: function () {} };
  }

  /* ------------------------------------------------------------------ */
  /* discovery: post slugs                                             */
  /* ------------------------------------------------------------------ */

  function parseList(text) {
    if (!text) return [];
    var out = [];

    /* p/index.js → window.PREPORTAL_POSTS = ["a","b"] */
    var m = text.match(/=\s*(\[[\s\S]*?\])/);
    if (m) {
      try {
        var arr = JSON.parse(m[1].replace(/,\s*\]/, ']').replace(/'/g, '"'));
        if (Array.isArray(arr)) return arr.map(String);
      } catch (e) { /* fall through to repair */ }
      /* repair: fix arrays with missing commas between elements ("a"\n"b" → "a","b") */
      try {
        var repaired = m[1].replace(/,\s*\]/, ']').replace(/'/g, '"').replace(/"\s*"/, '","');
        var arr2 = JSON.parse(repaired);
        if (Array.isArray(arr2)) return arr2.map(String);
      } catch (e2) { /* fall through */ }
    }

    /* p/manifest.json → {"posts":[...]} or [...] */
    try {
      var j = JSON.parse(text);
      if (Array.isArray(j)) return j.map(String);
      if (j && Array.isArray(j.posts)) return j.posts.map(String);
    } catch (e) { /* fall through */ }

    /* plain list / one slug per line — only accept valid slug shapes */
    text.split(/[\r\n,]+/).forEach(function (line) {
      var s = line.replace(/[^\w\-.\/]/g, '').replace(/\.js$/, '');
      /* reject anything that looks like comment text (contains slashes or too long) */
      if (/^[\w\-.]+$/.test(s) && s.length < 80 && s.indexOf('/') === -1) out.push(s);
    });
    return out;
  }

  function fromPostDirLists() {
    var candidates = [
      POSTS_DIR + '/index.js',
      DATA_DIR + '/posts.js',
      POSTS_DIR + '/manifest.json',
      POSTS_DIR + '/manifest.js',
      POSTS_DIR + '/_index.js'
    ];
    return candidates.reduce(function (chain, url) {
      return chain.then(function (acc) {
        if (acc.length) return acc;
        return fetchText(abs(url)).then(function (text) {
          var list = parseList(text);
          state.sources.push({ name: url, ok: !!list.length, count: list.length, detail: text ? 'parsed' : 'missing' });
          return list;
        });
      });
    }, Promise.resolve([]));
  }

  /* ------------------------------------------------------------------ */
  /* discovery: GitHub API (optional, public repos only, no token)     */
  /* ------------------------------------------------------------------ */

  function githubRepoInfo() {
    var source = CFG.contentRepository || {};
    var media = CFG.media || {};
    var owner = source.owner || media.githubOwner || '';
    var repo = source.repo || media.githubRepo || '';
    var branch = source.branch || media.githubBranch || '';

    if (!owner || !repo) {
      try {
        var saved = JSON.parse(localStorage.getItem('preportal:admin:keys') || '{}');
        owner = owner || saved.owner || '';
        repo = repo || saved.repo || '';
        branch = branch || saved.branch || '';
      } catch (e) { /* ignore */ }
    }

    // A fork published as a GitHub Pages project uses its own repository.
    // Custom domains retain the explicitly configured content repository.
    var host = String(location.hostname || '').match(/^([a-z0-9-]+)\.github\.io$/i);
    if (host && repo) {
      var project = String(location.pathname || '').split('/')[1] || '';
      if (project.toLowerCase() === repo.toLowerCase() ||
          (!project && repo.toLowerCase() === (host[1] + '.github.io').toLowerCase())) {
        owner = host[1];
      }
    }

    if (!owner || !repo) {
      var m = String(CFG.siteUrl || '').match(/^https?:\/\/([a-z0-9-]+)\.github\.io(?:\/([^/?#]+))?/i);
      if (m) {
        owner = owner || m[1];
        repo = repo || m[2] || (m[1] + '.github.io');
      }
    }

    return { owner: owner, repo: repo, branch: branch || 'main' };
  }

  // The same filename rules are used for local and published posts.
  function isPostFilename(name) {
    return /^[\w.-]+\.js$/.test(name) && name.charAt(0) !== '_' &&
      name.charAt(0) !== '.' && name !== 'index.js' && name.indexOf('manifest') === -1;
  }

  function fromLocalDirectory() {
    var name = 'local-directory';
    var url = abs(POSTS_DIR.replace(/\/+$/, '') + '/');
    function unavailable(detail) {
      state.sources.push({ name: name, ok: false, count: 0, detail: detail });
      return null;
    }

    if (!/^https?:$/.test(location.protocol)) return Promise.resolve(unavailable('HTTP server required'));
    return fetchText(url).then(function (html) {
      if (!html) return unavailable('directory unavailable');
      try {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var dir = new URL(url);
        // Recognize actual Python http.server, Apache and nginx autoindexes.
        // A SPA fallback or ordinary index page is not an empty directory.
        var headings = Array.prototype.map.call(doc.querySelectorAll('title, h1'), function (node) {
          return node.textContent.trim();
        });
        var listing = headings.some(function (heading) {
          var match = /^(?:Directory listing for|Index of)\s+(.+)$/i.exec(heading);
          if (!match) return false;
          var path = match[1].replace(/\/+$/, '');
          return path === dir.pathname.replace(/\/+$/, '') ||
            path === decodeURIComponent(dir.pathname).replace(/\/+$/, '');
        });
        if (!listing) return unavailable('directory listing disabled or unrecognized');

        var list = [];
        doc.querySelectorAll('a[href]').forEach(function (link) {
          try {
            var target = new URL(link.getAttribute('href'), dir);
            if (target.origin !== dir.origin || target.search || target.hash ||
                target.pathname.indexOf(dir.pathname) !== 0) return;
            var filename = decodeURIComponent(target.pathname.slice(dir.pathname.length));
            if (isPostFilename(filename)) list.push(filename.slice(0, -3));
          } catch (e) { /* ignore malformed links */ }
        });
        list = dedupe(list).sort();
        state.sources.push({ name: name, ok: true, count: list.length, detail: url });
        return list;
      } catch (e) {
        return unavailable('directory listing parse error');
      }
    });
  }

  function fromGithub() {
    var info = githubRepoInfo();
    if (!info.owner || !info.repo) {
      state.sources.push({ name: 'github', ok: false, count: 0, detail: 'no repo info' });
      return Promise.resolve(null);
    }
    // A complete tree can distinguish an empty folder from a failed scan.
    var api = 'https://api.github.com/repos/' + encodeURIComponent(info.owner) + '/' +
      encodeURIComponent(info.repo) + '/git/trees/' + encodeURIComponent(info.branch) + '?recursive=1';
    var prefix = POSTS_DIR.replace(/\/+$/, '') + '/';
    return fetchText(api, 7000).then(function (text) {
      if (!text) {
        state.sources.push({ name: 'github', ok: false, count: 0, detail: 'no response' });
        return null;
      }
      try {
        var result = JSON.parse(text);
        if (!result || !Array.isArray(result.tree) || result.truncated) {
          state.sources.push({ name: 'github', ok: false, count: 0, detail: 'incomplete tree' });
          return null;
        }
        var list = result.tree.filter(function (entry) {
          if (!entry || entry.type !== 'blob' || typeof entry.path !== 'string' ||
              entry.path.indexOf(prefix) !== 0 || entry.mode === '120000') return false;
          var name = entry.path.slice(prefix.length);
          return isPostFilename(name);
        }).map(function (entry) {
          return entry.path.slice(prefix.length, -3);
        });
        state.sources.push({ name: 'github', ok: true, count: list.length, detail: info.owner + '/' + info.repo });
        return list;
      } catch (e) {
        state.sources.push({ name: 'github', ok: false, count: 0, detail: 'parse error' });
        return null;
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* discovery: probe p/<slug>.js                                      */
  /* ------------------------------------------------------------------ */

  function probeSlugs() {
    var seeds = ['how-preportal-works'];
    try {
      var seen = Object.create(null);
      document.querySelectorAll('a[href*="slug="]').forEach(function (a) {
        var m = a.getAttribute('href').match(/slug=([^&#]+)/);
        if (m) seen[decodeURIComponent(m[1])] = 1;
      });
      Object.keys(seen).forEach(function (s) { if (seeds.indexOf(s) === -1) seeds.push(s); });
    } catch (e) { /* ignore */ }
    return seeds.slice(0, PROBE_LIMIT);
  }

  function probeExists(slug) {
    if (state.attempted[slug]) return Promise.resolve(state.attempted[slug] === 2);
    var url = abs(POSTS_DIR + '/' + slug + '.js');
    return fetchText(url, 5000).then(function (text) {
      var ok = !!text && /PREPORTAL_POST/.test(text);
      state.attempted[slug] = ok ? 2 : 1;
      return ok;
    });
  }

  function probeAll() {
    var seeds = probeSlugs();
    var found = [];
    var queue = seeds.slice();

    function worker() {
      if (!queue.length) return Promise.resolve();
      var slug = queue.shift();
      return probeExists(slug).then(function (ok) {
        if (ok) found.push(slug);
        return worker();
      });
    }

    var workers = [];
    for (var i = 0; i < CONCURRENCY; i++) workers.push(worker());
    return Promise.all(workers).then(function () {
      state.sources.push({ name: 'probe', ok: found.length > 0, count: found.length, detail: seeds.length + ' candidates tried' });
      return found;
    });
  }

  /* ------------------------------------------------------------------ */
  /* discovery: categories & users                                     */
  /* ------------------------------------------------------------------ */

  function parseRegistries(text) {
    /* extracts window.PREPORTAL_X.register({...}) objects from a file.
       Uses brace-counting instead of regex so nested braces (e.g. links:{}) work. */
    var out = [];
    if (!text) return out;

    var re = /window\.PREPORTAL_(CATEGORY|USER|POST)\.register\(/g;
    var m;
    while ((m = re.exec(text))) {
      var start = m.index + m[0].length; /* position after "register(" */
      var depth = 0;
      var i = start;
      while (i < text.length && depth >= 0) {
        var ch = text[i];
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) { i++; break; } }
        else if (ch === "'") { /* skip string literals */
          var j = i + 1;
          while (j < text.length && text[j] !== "'") j++;
          i = j;
        } else if (ch === '"') {
          var j2 = i + 1;
          while (j2 < text.length && text[j2] !== '"') j2++;
          i = j2;
        }
        i++;
      }
      var objText = text.slice(start, i); /* include outer braces */
      try {
        /* registry files use JS object literals (unquoted keys, single quotes) */
        var obj = new Function('return (' + objText + ')')();
        if (obj && typeof obj === 'object') out.push(obj);
      } catch (e) { /* ignore malformed */ }
    }
    return out;
  }

  function discoverCategories() {
    /* try category/index.js first, then probe category/*.js */
    return fetchText(abs(CAT_DIR + '/index.js')).then(function (text) {
      var items = parseRegistries(text);
      if (items.length) {
        state.sources.push({ name: CAT_DIR + '/index.js', ok: true, count: items.length, detail: 'parsed' });
        return items;
      }
      /* fall back to probing known category slugs */
      return probeDir(CAT_DIR, 'CATEGORY');
    });
  }

  function discoverUsers() {
    return fetchText(abs(USERS_DIR + '/index.js')).then(function (text) {
      var items = parseRegistries(text);
      if (items.length) {
        state.sources.push({ name: USERS_DIR + '/index.js', ok: true, count: items.length, detail: 'parsed' });
        return items;
      }
      return probeDir(USERS_DIR, 'USER');
    });
  }

  function probeDir(dir, kind) {
    /* probe a directory of registry files by guessing common slugs */
    var candidates = dir === CAT_DIR
      ? ['apps', 'games', 'guides', 'news', 'reviews', 'software', 'android', 'ios', 'windows']
      : ['preportal'];

    /* enrich with slugs seen in post/category data */
    try {
      var seen = Object.create(null);
      document.querySelectorAll('a[href*="cat="], a[href*="user="]').forEach(function (a) {
        var m = a.getAttribute('href').match(/(?:cat|user)=([^&#]+)/);
        if (m) seen[decodeURIComponent(m[1])] = 1;
      });
      Object.keys(seen).forEach(function (s) { if (candidates.indexOf(s) === -1) candidates.push(s); });
    } catch (e) { /* ignore */ }

    var found = [];
    var queue = candidates.slice();

    function worker() {
      if (!queue.length) return Promise.resolve();
      var slug = queue.shift();
      var url = abs(dir + '/' + slug + '.js');
      return fetchText(url, 5000).then(function (text) {
        var items = parseRegistries(text);
        if (items.length) {
          items.forEach(function (it) { found.push(it); });
          state.attempted[dir + '/' + slug] = 2;
        } else {
          state.attempted[dir + '/' + slug] = 1;
        }
        return worker();
      });
    }

    var workers = [];
    for (var i = 0; i < CONCURRENCY; i++) workers.push(worker());
    return Promise.all(workers).then(function () {
      state.sources.push({ name: dir + '/probe', ok: found.length > 0, count: found.length, detail: candidates.length + ' candidates tried' });
      return found;
    });
  }

  /* ------------------------------------------------------------------ */
  /* loading post files                                                */
  /* ------------------------------------------------------------------ */

  function loadScript(src) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function () {
        try { s.parentNode && s.parentNode.removeChild(s); } catch (e) { /* ignore */ }
        resolve(true);
      };
      s.onerror = function () {
        try { s.parentNode && s.parentNode.removeChild(s); } catch (e) { /* ignore */ }
        resolve(false);
      };
      document.head.appendChild(s);
    });
  }

  function coreLoaded() {
    var store = global.PrePortal && global.PrePortal.Store;
    return !!(store && store.posts);
  }

  function coreHas(slug) {
    var store = global.PrePortal && global.PrePortal.Store;
    return !!(store && store.posts && store.posts[slug]);
  }

  function loadPosts(slugs) {
    var missing = slugs.filter(function (s) { return !coreHas(s); });
    if (!missing.length) {
      state.sources.push({ name: 'core', ok: true, count: slugs.length, detail: 'loaded by core.js' });
      return Promise.resolve([]);
    }
    return missing.reduce(function (chain, slug) {
      return chain.then(function (failures) {
        return loadScript(abs(POSTS_DIR + '/' + slug + '.js')).then(function (ok) {
          if (!ok) failures.push(slug);
          return failures;
        });
      });
    }, Promise.resolve([])).then(function (failures) {
      if (failures.length) {
        state.sources.push({ name: 'files', ok: false, count: failures.length, detail: 'failed: ' + failures.slice(0, 5).join(', ') });
      } else {
        state.sources.push({ name: 'files', ok: true, count: missing.length, detail: 'loaded as scripts' });
      }
      return failures;
    });
  }

  /* ------------------------------------------------------------------ */
  /* index building                                                      */
  /* ------------------------------------------------------------------ */

  function buildSearchIndex() {
    /* build a lightweight search index from all registered posts */
    var posts = global.PrePortalEngine ? global.PrePortalEngine.posts() : [];
    var index = posts.map(function (p) {
      var text = ((p.title || '') + ' ' + (p.excerpt || '') + ' ' + stripTags(p.content || '')).toLowerCase();
      var keywords = ((p.keywords || []).join(' ') + ' ' + (p.tags || []).join(' ')).toLowerCase();
      return {
        slug: p.slug,
        title: p.title || '',
        url: 'post.html?slug=' + encodeURIComponent(p.slug),
        category: p.category || null,
        categoryName: p.categoryName || null,
        parent: p.parent || null,
        parentName: p.parentName || null,
        author: p.author || null,
        authorName: p.authorName || null,
        excerpt: p.excerpt || '',
        date: p.date || '',
        tags: p.tags || [],
        keywords: p.keywords || [],
        cover: p.cover || '',
        text: text
      };
    });
    state.searchIndex = index;
    return index;
  }

  function buildCategoryCounts() {
    /* count posts per category */
    var posts = global.PrePortalEngine ? global.PrePortalEngine.posts() : [];
    var counts = Object.create(null);
    posts.forEach(function (p) {
      if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
    });
    state.categoryCounts = counts;
    return counts;
  }

  /* ------------------------------------------------------------------ */
  /* main flow                                                         */
  /* ------------------------------------------------------------------ */

  function discover() {
    function fallback() {
      var cached = fromCache();
      if (cached !== null) {
        state.sources.push({ name: 'cache', ok: true, count: cached.length, detail: 'last known list' });
        return cached;
      }
      return fromPostDirLists().then(function (list) {
        return list.length ? list : probeAll();
      });
    }

    // Local content is independent of the published GitHub repository.
    if (isLocalHost()) {
      return fromLocalDirectory().then(function (local) {
        return local !== null ? local : fallback();
      });
    }

    // An empty successful scan is authoritative.
    return fromGithub().then(function (gh) {
      return gh !== null ? gh : fallback();
    });
  }

  function fromCache() {
    try {
      var raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!raw || !Array.isArray(raw.slugs)) return null;
      if (Date.now() - (raw.at || 0) > CACHE_TTL) return null;
      state.cacheUsed = true;
      return raw.slugs.slice();
    } catch (e) { return null; }
  }

  function toCache(slugs) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), slugs: slugs })); } catch (e) { /* quota */ }
  }

  function dedupe(list) {
    var seen = Object.create(null), out = [];
    list.forEach(function (s) {
      var k = String(s || '').trim();
      if (!k || seen[k]) return;
      seen[k] = 1;
      out.push(k);
    });
    return out;
  }

  function registerSlug(slug) {
    if (slug && !registry.posts[slug]) registry.posts[slug] = true;
  }

  function run() {
    if (state.loading) return state.loading;
    state.lastRun = Date.now();
    var previousSlugs = state.slugs.slice();

    state.loading = discover()
      .then(dedupe)
      .then(function (slugs) {
        // Remove deleted posts from the live registry on a successful rescan.
        if (state.sources.some(function (source) { return (source.name === 'github' || source.name === 'local-directory') && source.ok; })) {
          var store = global.PrePortal && global.PrePortal.Store;
          previousSlugs.forEach(function (slug) {
            if (slugs.indexOf(slug) !== -1) return;
            delete registry.posts[slug];
            if (store && store.posts) delete store.posts[slug];
            if (store && Array.isArray(store._postList)) {
              store._postList = store._postList.filter(function (item) { return item !== slug; });
            }
          });
        }
        state.slugs = slugs;
        return Promise.all([
          loadPosts(slugs),
          discoverCategories(),
          discoverUsers()
        ]);
      })
      .then(function (results) {
        var failures = results[0];
        var cats = results[1] || [];
        var users = results[2] || [];

        /* register categories */
        cats.forEach(function (c) {
          if (c.slug) {
            registry.categories[c.slug] = c;
            global.PREPORTAL_CATEGORY.register(c);
          }
        });

        /* register users */
        users.forEach(function (u) {
          if (u.slug) {
            registry.users[u.slug] = u;
            global.PREPORTAL_USER.register(u);
          }
        });

        var good = state.slugs.filter(function (s) {
          if (failures.indexOf(s) !== -1) return false;
          if (coreLoaded()) return coreHas(s);
          return true;
        });
        state.slugs = good;
        good.forEach(registerSlug);
        if (!state.cacheUsed && (good.length || state.sources.some(function (source) {
          return (source.name === 'github' || source.name === 'local-directory') && source.ok;
        }))) toCache(good);

        buildCategoryCounts();
        buildSearchIndex();

        state.loaded = true;
        state.loading = null;
        log('ready:', good.length, 'posts', state.sources);
        return good;
      })
      .catch(function (e) {
        state.loaded = true;
        state.loading = null;
        log('error:', e && e.message);
        return [];
      });

    return state.loading;
  }

  /* ------------------------------------------------------------------ */
  /* public API                                                        */
  /* ------------------------------------------------------------------ */

  function registerPost(obj) {
    if (!obj || !obj.slug) return false;
    if (global.PREPORTAL_POST && global.PREPORTAL_POST.register) {
      global.PREPORTAL_POST.register(obj);
    }
    registerSlug(obj.slug);
    if (state.slugs.indexOf(obj.slug) === -1) state.slugs.push(obj.slug);
    try {
      document.dispatchEvent(new CustomEvent('preportal:post-added', { detail: { slug: obj.slug } }));
    } catch (e) { /* ignore */ }
    return true;
  }

  function refresh() {
    if (state.loading) return state.loading;
    state.loaded = false;
    state.sources = [];
    state.attempted = Object.create(null);
    state.cacheUsed = false;
    return run();
  }

  function posts() {
    if (!global.PrePortal || !global.PrePortal.Store || !global.PrePortal.Store.posts) return [];
    return Object.keys(global.PrePortal.Store.posts).map(function (k) {
      var p = global.PrePortal.Store.posts[k];
      return Object.assign({}, p, { categoryName: getCategory(p.category) && getCategory(p.category).name || null });
    });
  }

  function categories() {
    var counts = state.categoryCounts || Object.create(null);
    return Object.keys(registry.categories).map(function (k) {
      var c = Object.assign({}, registry.categories[k], { count: counts[k] || 0 });
      return c;
    });
  }

  function users() {
    return Object.keys(registry.users).map(function (k) {
      return Object.assign({}, registry.users[k]);
    });
  }

  function getCategory(slug) {
    return registry.categories[slug] || null;
  }

  function getUser(slug) {
    return registry.users[slug] || null;
  }

  function search(q) {
    var index = state.searchIndex || [];
    if (!q) return index.slice();
    var terms = lower(q).split(/\s+/).filter(Boolean);
    if (!terms.length) return index.slice();

    return index.filter(function (item) {
      var haystack = ((item.text || '') + ' ' + (item.title || '') + ' ' + (item.categoryName || '') + ' ' + (item.authorName || '') + ' ' + ((item.tags || []).join(' ')) + ' ' + ((item.keywords || []).join(' '))).toLowerCase();
      return terms.every(function (t) { return haystack.indexOf(t) !== -1; });
    });
  }

  function report() {
    return {
      ready: state.loaded,
      posts: state.slugs.slice(),
      count: state.slugs.length,
      categories: Object.keys(registry.categories).length,
      users: Object.keys(registry.users).length,
      sources: state.sources.slice(),
      cacheUsed: state.cacheUsed,
      lastRun: state.lastRun ? new Date(state.lastRun).toISOString() : null,
      dirs: { posts: POSTS_DIR, categories: CAT_DIR, users: USERS_DIR, data: DATA_DIR },
      github: githubRepoInfo()
    };
  }

  function sources() {
    return state.sources.slice();
  }

  /* ------------------------------------------------------------------ */

  ensureRegistries();

  var Engine = {
    version: '2.0.0',
    ready: function () { return state.loaded && !state.loading ? Promise.resolve(state.slugs.slice()) : run(); },
    isReady: function () { return state.loaded && !state.loading; },
    refresh: refresh,
    slugs: function () { return state.slugs.slice(); },
    posts: posts,
    categories: categories,
    users: users,
    search: search,
    getCategory: getCategory,
    getUser: getUser,
    registerPost: registerPost,
    registerSlug: registerSlug,
    report: report,
    sources: sources,
    cacheClear: function () { try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* ignore */ } }
  };

  global.PrePortalEngine = Engine;

  /* when core.js Store is ready, sync the engine list */
  if (global.PrePortal && global.PrePortal.engineList) {
    global.PrePortal.engineList = function () { return state.slugs.slice(); };
  }
})(window);

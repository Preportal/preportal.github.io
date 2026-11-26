/* =====================================================================
   PrePortal — admin panel (admin.html)
   Overview · Posts · Categories · Authors · Appearance · Ads · Settings · Publish keys
   Everything runs in the browser; the panel produces files you commit to the repo.
   ===================================================================== */
(function () {
  var P = window.PrePortal;
  var T = P.t;

  var LS = {
    trash: 'preportal:admin:trash',
    css: 'preportal:admin:css',
    js: 'preportal:admin:js',
    head: 'preportal:admin:head',
    ads: 'preportal:admin:ads',
    keys: 'preportal:admin:keys'
  };

  var view = 'overview';
  var postFilter = { q: '', cat: '', author: '', sort: 'new' };

  document.addEventListener('preportal:ready', async function () {
    if (window.PP_I18N && window.PP_I18N.whenReady) { try { await window.PP_I18N.whenReady(); } catch (e) { } }
    if (!P.qs('#adminNav')) return;
    mountNav();
    render();
  });

  /* ---------------------------------------------------------- storage */
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { P.toast(T('admin.copyFailed'), 'error'); return false; }
  }

  /* ---------------------------------------------------------- navigation */
  var TABS = [
    { id: 'overview', label: 'admin.navOverview', icon: 'grid' },
    { id: 'posts', label: 'admin.navPosts', icon: 'pen' },
    { id: 'categories', label: 'admin.navCategories', icon: 'folder' },
    { id: 'users', label: 'admin.navUsers', icon: 'user' },
    { id: 'appearanceAds', label: 'admin.navAppearanceAds', icon: 'paint' },
    { id: 'settings', label: 'admin.navSettings', icon: 'settings' },
    { id: 'security', label: 'admin.navSecurity', icon: 'lock' }
  ];

  function mountNav() {
    var host = P.qs('#adminNav');
    if (host.dataset.mounted) return;
    host.dataset.mounted = '1';
    host.innerHTML = TABS.map(function (t) {
      return '<button class="admin-nav__item" type="button" data-view="' + t.id + '">' +
        P.icon(t.icon || 'grid', 16) + '<span>' + P.esc(T(t.label)) + '</span>' +
        (t.id === 'posts' ? '<small>' + P.num(P.allPosts().length) + '</small>' : '') +
        '</button>';
    }).join('');
    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-view]');
      if (!b) return;
      view = b.getAttribute('data-view');
      if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    var initial = (location.hash || '').replace('#', '');
    if (initial && TABS.some(function (t) { return t.id === initial; })) view = initial;

    window.addEventListener('hashchange', function () {
      var h = (location.hash || '').replace('#', '');
      if (h && h !== view && TABS.some(function (t) { return t.id === h; })) {
        view = h;
        render();
      }
    });

    /* dil değişince nav etiketleri + tüm panel yeniden çizilsin */
    document.addEventListener('preportal:lang', function () {
      P.qsa('#adminNav [data-view]').forEach(function (b) {
        var key = 'admin.nav' + b.getAttribute('data-view').charAt(0).toUpperCase() + b.getAttribute('data-view').slice(1);
        var span = b.querySelector('span');
        if (span) span.textContent = T(key);
      });
      render();
    });
  }

  /* ---------------------------------------------------------- shell */
  var HEAD = {
    overview: ['admin.navOverview', 'admin.postsHelp'],
    posts: ['admin.navPosts', 'admin.postsHelp'],
    categories: ['admin.navCategories', 'admin.categoriesHelp'],
    users: ['admin.navUsers', 'admin.usersHelp'],
    appearanceAds: ['admin.navAppearanceAds', 'admin.appearanceAdsHelp'],
    settings: ['admin.navSettings', 'admin.settingsHelp'],
    security: ['admin.navSecurity', 'admin.securityHelp']
  };

  function render() {
    P.qsa('#adminNav [data-view]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-view') === view);
    });
    P.qsa('.admin-section').forEach(function (s) {
      s.hidden = s.getAttribute('data-panel') !== view;
    });
    var head = HEAD[view] || HEAD.overview;
    P.qs('#adminTitle').textContent = T(head[0]);
    P.qs('#adminLead').textContent = T(head[1]);
    var badge = P.qs('#adminBadge');
    if (badge) {
      badge.textContent = P.CFG.siteName + ' · ' + String(P.CFG.siteUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
    var panel = P.qs('#panel' + view.charAt(0).toUpperCase() + view.slice(1));
    if (!panel) return;
    var fn = {
      overview: renderOverview,
      posts: renderPosts,
      categories: renderCategories,
      users: renderUsers,
      appearanceAds: renderAppearanceAds,
      settings: renderSettings,
      security: renderSecurity
    }[view];
    panel.innerHTML = '';
    if (fn) fn(panel);
    P.reveal();
  }

  /* ---------------------------------------------------------- overview */
  function renderOverview(host) {
    var posts = P.allPosts();
    var pub = P.publishedPosts();
    var cats = P.categoriesWithCount();
    var users = Object.keys(P.Store.users);
    var keys = 0;
    posts.forEach(function (p) { keys += P.postKeywords(p).length; });

    var eng = window.PrePortalEngine || null;
    var engRep = eng && eng.report ? eng.report() : null;
    var engineReady = !!(engRep && engRep.ready);
    var engineCount = engRep ? engRep.count : 0;
    var engineSources = engRep ? (engRep.sources || []) : [];
    var issues = healthCheck();

    var stats = [
      [pub.length, T('admin.published')],
      [cats.length, T('admin.categories')],
      [users.length, T('admin.authors')],
      [P.allTags().length, T('admin.tags')],
      [keys, T('admin.keywords')]
    ];

    host.innerHTML = [
      '<div class="admin-stats">' + stats.map(function (s) {
        return '<div class="stat"><b>' + P.num(s[0]) + '</b><span>' + P.esc(s[1]) + '</span></div>';
      }).join('') + '</div>',

      '<div class="admin-grid-2">',
      '<div class="panel"><div class="panel-head"><h4>' + P.esc(T('admin.engine')) + '</h4>' +
      (engineReady ? '<span class="badge-soft is-ok">' + P.icon('check', 12) + ' ' + P.esc(T('admin.engineReady', { n: engineCount })) + '</span>'
        : '<span class="badge-soft is-warn">' + P.esc(T('admin.engineIdle')) + '</span>') + '</div>' +
      '<p class="muted" style="font-size:.82rem;margin:0 0 10px">' + P.esc(T('admin.engineHelp')) + '</p>' +
      '<div class="draft-list">' + engineSources.map(function (s) {
        return '<div class="draft-item" style="gap:8px">' +
          '<span style="color:' + (s.ok ? 'var(--ok)' : 'var(--text-3)') + '">' + P.icon(s.ok ? 'check' : 'minus', 13) + '</span>' +
          '<span style="flex:1;min-width:0;font-family:var(--mono);font-size:.76rem">' + P.esc(s.name) + '</span>' +
          '<small class="muted">' + P.esc(s.ok ? (s.count + ' · ' + s.detail) : s.detail) + '</small></div>';
      }).join('') + '</div>' +
      '<div class="admin-toolbar" style="margin-top:10px;gap:8px">' +
      '<button class="btn btn--soft btn--sm" type="button" id="ovEngineRefresh">' + P.icon('refresh', 14) + ' ' + P.esc(T('admin.engineRefresh')) + '</button>' +
      '</div>' +
      '<p class="muted" style="font-size:.78rem;margin:10px 0 0">' + P.esc(T('admin.engineNote')) + '</p>' +
      '</div>',

      '<div class="panel"><div class="panel-head"><h4>' + P.esc(T('admin.warnings')) + '</h4></div>' +
      (issues.length
        ? '<div class="draft-list">' + issues.map(function (i) {
          return '<div class="draft-item"><span class="draft-dot"></span><span>' + P.esc(i) + '</span></div>';
        }).join('') + '</div>'
        : '<p class="muted" style="font-size:.85rem;margin:0">' + P.esc(T('admin.healthOk')) + '</p>') +
      '</div>',
      '</div>',

      '<div class="panel" style="margin-top:16px"><div class="panel-head"><h4>' + P.esc(T('admin.posts')) + '</h4>' +
      '<a class="btn btn--ghost btn--sm" href="create.html">' + P.esc(T('admin.newPost')) + '</a></div>',
      '<div class="table-wrap"><table class="admin-table"><thead><tr>',
      '<th>' + P.esc(T('admin.colTitle')) + '</th><th>' + P.esc(T('admin.colCategory')) + '</th><th>' + P.esc(T('admin.colAuthor')) + '</th><th>' + P.esc(T('admin.colDate')) + '</th><th></th>',
      '</tr></thead><tbody>',
      (posts.slice(0, 6).map(function (p) { return postRow(p); }).join('') || '<tr><td colspan="5" class="muted">' + P.esc(T('admin.noPosts')) + '</td></tr>'),
      '</tbody></table></div></div>'
    ].join('');

    var refreshBtn = P.qs('#ovEngineRefresh');
    if (refreshBtn) refreshBtn.addEventListener('click', async function () {
      if (!eng || !eng.refresh) return;
      refreshBtn.disabled = true;
      P.toast(T('admin.engineScanning'), 'info');
      try {
        await eng.refresh();
        P.toast(T('admin.engineDone'), 'success');
        render();
      } catch (e) {
        P.toast(T('admin.engineFailed'), 'error');
      }
      refreshBtn.disabled = false;
    });

  }

  function healthCheck() {
    var out = [];
    var postsDir = P.CFG.postsDir || 'p', catDir = P.CFG.categoryDir || 'category', usersDir = P.CFG.usersDir || 'users';
    (window.PREPORTAL_POSTS || []).forEach(function (id) {
      if (!P.Store.posts[id]) out.push(T('admin.warnIndexNoFile', { path: postsDir + '/' + id + '.js' }));
    });
    Object.keys(P.Store.posts).forEach(function (id) {
      var p = P.Store.posts[id];
      if ((window.PREPORTAL_POSTS || []).indexOf(id) === -1) out.push(T('admin.warnFileNotIndexed', { slug: id }));
      if (!P.Store.categories[p.category]) out.push(T('admin.warnCategory', { cat: p.category, slug: id }));
      if (!P.Store.users[p.author]) out.push(T('admin.warnAuthor', { author: p.author, slug: id }));
      if (!p.cover) out.push(T('admin.warnCover', { slug: id }));
      if (!P.postKeywords(p).length) out.push(T('admin.warnKeywords', { slug: id }));
    });
    (window.PREPORTAL_CATEGORIES || []).forEach(function (id) {
      if (!P.Store.categories[id]) out.push(T('admin.warnCatIndexNoFile', { path: catDir + '/' + id + '.js' }));
    });
    (window.PREPORTAL_USERS || []).forEach(function (id) {
      if (!P.Store.users[id]) out.push(T('admin.warnUserIndexNoFile', { path: usersDir + '/' + id + '.js' }));
    });
    /* içerik motoru hazır değilse (dosya yolu/klasör sorunu) uyar */
    var eng = window.PrePortalEngine;
    if (!eng || !eng.isReady || !eng.isReady()) {
      out.push(T('admin.warnNoEngine'));
    }
    return out;
  }

  /* ---------------------------------------------------------- posts */
  function postRow(p) {
    var cat = P.getCategory(p.category);
    var author = P.getUser(p.author);
    var kw = P.postKeywords(p).length;
    return '<tr data-slug="' + P.esc(p.slug) + '">' +
      '<td><div class="cell-title"><b>' + P.esc(p.title) + '</b>' +
      '<small>' + P.esc((P.CFG.postsDir || 'p') + '/' + p.slug + '.js') + '</small></div></td>' +
      '<td><span class="badge-soft">' + P.esc(cat.name) + '</span></td>' +
      '<td>' + P.esc(author.name) + '</td>' +
      '<td><small class="muted">' + P.esc(P.formatDate(p.date)) + '</small></td>' +
      '<td><div class="cell-actions">' +
      (p.featured ? '<span class="badge-soft is-ok" title="' + P.esc(T('admin.featured')) + '">★</span>' : '') +
      '<span class="badge-soft" title="' + P.esc(T('admin.keywords')) + '">' + kw + '</span>' +
      '<a class="btn btn--ghost btn--sm" href="edit.html?slug=' + encodeURIComponent(p.slug) + '">' + P.esc(T('admin.edit')) + '</a>' +
      '<a class="btn btn--ghost btn--sm" href="post.html?slug=' + encodeURIComponent(p.slug) + '" target="_blank" rel="noopener">' + P.esc(T('admin.open')) + '</a>' +
      '</div></td></tr>';
  }

  function renderPosts(host) {
    var cats = P.categoriesWithCount();
    var authors = Object.keys(P.Store.users);
    host.innerHTML = [
      '<div class="panel">',
      '<div class="admin-toolbar">',
      '<div class="admin-search">' + P.icon('search', 17) +
      '<input class="input" type="search" id="apQ" aria-label="' + P.esc(T('admin.searchPlaceholder')) + '" placeholder="' + P.esc(T('admin.searchPlaceholder')) + '" value="' + P.esc(postFilter.q) + '"></div>',
      '<div class="select-wrap"><select class="select" id="apCat"><option value="">' + P.esc(T('admin.allCategories')) + '</option>' +
      cats.map(function (c) { return '<option value="' + P.esc(c.slug) + '"' + (postFilter.cat === c.slug ? ' selected' : '') + '>' + P.esc(c.name) + '</option>'; }).join('') + '</select></div>',
      '<div class="select-wrap"><select class="select" id="apAuthor"><option value="">' + P.esc(T('admin.allAuthors')) + '</option>' +
      authors.map(function (a) { return '<option value="' + P.esc(a) + '"' + (postFilter.author === a ? ' selected' : '') + '>' + P.esc(P.getUser(a).name) + '</option>'; }).join('') + '</select></div>',
      '<div class="select-wrap"><select class="select" id="apSort">' +
      ['new', 'old', 'az'].map(function (s) { return '<option value="' + s + '"' + (postFilter.sort === s ? ' selected' : '') + '>' + P.esc(T('admin.sort' + s.charAt(0).toUpperCase() + s.slice(1))) + '</option>'; }).join('') +
      '</select></div>',
      '<a class="btn btn--primary btn--sm" href="create.html">' + P.icon('plus', 15) + '<span>' + P.esc(T('admin.newPost')) + '</span></a>',
      '</div>',
      '<div id="apTable"></div>',
      '</div>',

      '<div class="panel"><div class="panel-head"><h4>' + P.esc(T('admin.trashTitle')) + '</h4>' +
      '<button class="btn btn--ghost btn--sm" type="button" id="apRestoreAll">' + P.esc(T('admin.reset')) + '</button></div>' +
      '<p class="muted" style="font-size:.82rem;margin:0 0 10px">' + P.esc(T('admin.trashHelp')) + '</p>' +
      '<div id="apTrash" class="draft-list"></div></div>'
    ].join('');

    var paint = function () {
      var list = P.allPosts();
      if (postFilter.q) list = P.searchPosts(postFilter.q);
      if (postFilter.cat) list = list.filter(function (p) { return p.category === postFilter.cat; });
      if (postFilter.author) list = list.filter(function (p) { return p.author === postFilter.author; });
      if (postFilter.sort === 'old') list = list.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
      if (postFilter.sort === 'az') list = list.slice().sort(function (a, b) { return a.title.localeCompare(b.title); });

      P.qs('#apTable').innerHTML = '<div class="table-wrap"><table class="admin-table"><thead><tr>' +
        ['admin.colTitle', 'admin.colCategory', 'admin.colAuthor', 'admin.colDate', ''].map(function (k) {
          return '<th>' + (k ? P.esc(T(k)) : '') + '</th>';
        }).join('') + '</tr></thead><tbody>' +
        (list.length ? list.map(postRow).join('') : '<tr><td colspan="5" class="muted">' + P.esc(T('admin.noResults')) + '</td></tr>') +
        '</tbody></table></div>';
    };

    P.qs('#apQ').addEventListener('input', function (e) { postFilter.q = e.target.value.trim(); paint(); });
    P.qs('#apCat').addEventListener('change', function (e) { postFilter.cat = e.target.value; paint(); });
    P.qs('#apAuthor').addEventListener('change', function (e) { postFilter.author = e.target.value; paint(); });
    P.qs('#apSort').addEventListener('change', function (e) { postFilter.sort = e.target.value; paint(); });

    var trash = read(LS.trash, []);
    var th = P.qs('#apTrash');
    th.innerHTML = trash.length ? trash.map(function (t) {
      return '<div class="draft-item"><span style="flex:1;min-width:0"><b>' + P.esc(t.title) + '</b><br><small class="muted">' + P.esc(t.slug) + '</small></span>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-restore="' + P.esc(t.slug) + '">' + P.esc(T('admin.restore')) + '</button></div>';
    }).join('') : '<span class="muted" style="font-size:.84rem">' + P.esc(T('admin.trashEmpty')) + '</span>';
    th.addEventListener('click', function (e) {
      var b = e.target.closest('[data-restore]');
      if (!b) return;
      trash = trash.filter(function (t) { return t.slug !== b.getAttribute('data-restore'); });
      write(LS.trash, trash);
      P.toast(T('admin.restore'), 'success');
      renderPosts(host);
    });
    P.qs('#apRestoreAll').addEventListener('click', function () {
      write(LS.trash, []);
      renderPosts(host);
    });

    paint();
  }

  /* ---------------------------------------------------------- categories */
  function renderCategories(host) {
    var cats = P.categoriesWithCount();
    var catDir = P.CFG.categoryDir || 'category';

    host.innerHTML = [
      '<div class="admin-grid-2">',
      '<div class="panel"><div class="panel-head"><h4 id="catFormTitle">' + P.esc(T('admin.catCreate')) + '</h4>' +
      '<button class="btn btn--ghost btn--sm" type="button" id="catReset">' + P.esc(T('admin.reset')) + '</button></div>',
      '<div class="admin-form">',
      row('catName', 'admin.catName', 'text', ''),
      row('catSlug', 'admin.catSlug', 'text', '', 'mono'),
      row('catDesc', 'admin.catDesc', 'textarea', ''),
      '<div class="form-row"><label class="label" for="catParent">' + P.esc(T('admin.catParent')) + '</label>' +
      '<div class="select-wrap"><select class="select" id="catParent"><option value="">' + P.esc(T('admin.parentNone')) + '</option>' +
      cats.filter(function (c) { return !c.parent; }).map(function (c) { return '<option value="' + P.esc(c.slug) + '">' + P.esc(c.name) + '</option>'; }).join('') + '</select></div></div>',
      '<div class="admin-grid-2 admin-grid-2--tight">',
      row('catIcon', 'admin.catIcon', 'text', 'folder'),
      row('catOrder', 'admin.catOrder', 'number', '0'),
      '</div>',
      row('catKeywords', 'admin.keywords', 'textarea', ''),
      '<span class="hint">' + P.esc(T('studio.fKeywordsHint')) + '</span>',
      '<div style="display:flex;gap:8px;flex-wrap:wrap">',
      '<button class="btn btn--primary btn--sm" type="button" id="catCreate">' + P.esc(T('admin.catCreate')) + '</button>',
      '<button class="btn btn--soft btn--sm" type="button" id="catDownload">' + P.esc(T('admin.download')) + '</button>',
      '<button class="btn btn--ghost btn--sm" type="button" id="catCopy">' + P.esc(T('admin.copy')) + '</button>',
      '</div>',
      '<div class="form-row"><span class="label" id="catScriptName">' + P.esc(T('admin.catScript')) + '</span>' +
      '<pre class="code-box" id="catPreview"></pre></div>',
      '</div></div>',

      '<div class="panel"><div class="panel-head"><h4>' + P.esc(T('admin.catPreview')) + '</h4></div>',
      '<div class="admin-tree" id="catTree"></div>',
      '<h4 style="margin:18px 0 8px;font-size:.8rem;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3)">' + P.esc(T('admin.catExisting')) + '</h4>',
      '<div class="draft-list" id="catList"></div></div>',
      '</div>'
    ].join('');

    /* tree */
    var tops = cats.filter(function (c) { return !c.parent; });
    var treeHTML = tops.map(function (c) {
      var kids = cats.filter(function (x) { return x.parent === c.slug; });
      return '<div class="admin-tree__item">' + P.icon(c.icon || 'folder', 15) + '<b>' + P.esc(c.name) + '</b>' +
        '<small>' + P.esc(c.slug) + ' · ' + c.count + '</small></div>' +
        kids.map(function (k) {
          return '<div class="admin-tree__item is-child">' + P.icon(k.icon || 'folder', 14) + '<span>' + P.esc(k.name) + '</span>' +
            '<small>' + P.esc(k.slug) + ' · ' + k.count + '</small></div>';
        }).join('');
    }).join('');
    var orphans = cats.filter(function (c) { return c.parent && !cats.some(function (x) { return x.slug === c.parent; }); });
    P.qs('#catTree').innerHTML = (treeHTML || '<span class="muted" style="font-size:.84rem">' + P.esc(T('home.noCategories')) + '</span>') +
      orphans.map(function (c) { return '<div class="admin-tree__item">' + P.icon('folder', 15) + P.esc(c.name) + '<small>' + P.esc(c.parent) + '?</small></div>'; }).join('');

    P.qs('#catList').innerHTML = cats.map(function (c) {
      return '<div class="draft-item"><span style="flex:1;min-width:0"><b>' + P.esc(c.name) + '</b><br><small class="muted">' +
        P.esc(catDir + '/' + c.slug + '.js') + (c.parent ? ' · ' + P.esc(c.parent) : '') + ' · ' + c.count + '</small></span>' +
        '<button class="icon-btn" type="button" data-edit-cat="' + P.esc(c.slug) + '" title="' + P.esc(T('admin.edit')) + '">' + P.icon('pen', 15) + '</button></div>';
    }).join('');

    var getEl = function (id) { return P.qs('#' + id); };
    var slugTouched = false;
    getEl('catName').addEventListener('input', function (e) {
      if (!slugTouched) getEl('catSlug').value = P.slugify(e.target.value);
      updatePreview();
    });
    getEl('catSlug').addEventListener('input', function () { slugTouched = true; updatePreview(); });
    ['catDesc', 'catParent', 'catIcon', 'catOrder', 'catKeywords'].forEach(function (id) {
      getEl(id).addEventListener('input', updatePreview);
      getEl(id).addEventListener('change', updatePreview);
    });

    function collectCat() {
      return {
        slug: P.slugify(getEl('catSlug').value || getEl('catName').value),
        name: getEl('catName').value.trim(),
        description: getEl('catDesc').value.trim(),
        parent: getEl('catParent').value,
        icon: getEl('catIcon').value.trim() || 'folder',
        order: parseInt(getEl('catOrder').value, 10) || 0,
        keywords: getEl('catKeywords').value.split(/[,\n]/).map(function (s) { return s.trim(); }).filter(Boolean)
      };
    }
    function updatePreview() {
      var c = collectCat();
      P.qs('#catScriptName').textContent = catDir + '/' + (c.slug || 'slug') + '.js';
      P.qs('#catPreview').innerHTML = P.publish.highlight(P.publish.buildCategoryFile(c));
    }
    updatePreview();

    P.qs('#catCreate').addEventListener('click', function () {
      var c = collectCat();
      if (!c.name) { P.toast(T('admin.catName'), 'error'); return; }
      P.download(c.slug + '.js', P.publish.buildCategoryFile(c));
      P.toast(T('admin.downloaded', { file: catDir + '/' + c.slug + '.js' }), 'success');
    });
    P.qs('#catDownload').addEventListener('click', function () {
      var c = collectCat();
      P.download(c.slug + '.js', P.publish.buildCategoryFile(c));
    });
    P.qs('#catCopy').addEventListener('click', async function () {
      var ok = await P.copyText(P.publish.buildCategoryFile(collectCat()));
      P.toast(ok ? T('admin.copy') : T('admin.copyFailed'), ok ? 'success' : 'error');
    });
    P.qs('#catReset').addEventListener('click', function () { renderCategories(host); });
    P.qs('#catList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-edit-cat]');
      if (!b) return;
      var c = P.Store.categories[b.getAttribute('data-edit-cat')];
      if (!c) return;
      getEl('catName').value = c.name || '';
      getEl('catSlug').value = c.slug || '';
      getEl('catDesc').value = c.description || '';
      getEl('catParent').value = c.parent || '';
      getEl('catIcon').value = c.icon || 'folder';
      getEl('catOrder').value = c.order || 0;
      slugTouched = true;
      P.qs('#catFormTitle').textContent = T('admin.catUpdate');
      updatePreview();
    });
  }

  /* ---------------------------------------------------------- authors */
  function renderUsers(host) {
    var usersDir = P.CFG.usersDir || 'users';

    host.innerHTML = [
      '<div class="admin-grid-2">',
      '<div class="panel"><div class="panel-head"><h4 id="userFormTitle">' + P.esc(T('admin.userCreate')) + '</h4>',
      '</div>',
      '<p class="muted" style="font-size:.82rem;margin:0 0 10px">' + P.esc(T('admin.authorNote')) + '</p>',
      '<div class="admin-form">',
      row('uName', 'admin.userName', 'text', ''),
      row('uSlug', 'admin.userSlug', 'text', '', 'mono'),
      row('uRole', 'admin.userRole', 'text', ''),
      row('uBio', 'admin.userBio', 'textarea', ''),
      row('uAvatar', 'admin.userAvatar', 'text', 'assets/img/logo.png'),
      row('uEmail', 'admin.userEmail', 'text', ''),
      row('uLinks', 'admin.userLinks', 'textarea', 'GitHub | https://github.com/'),
      '<div style="display:flex;gap:8px;flex-wrap:wrap">',
      '<button class="btn btn--primary btn--sm" type="button" id="userCreate">' + P.esc(T('admin.userCreate')) + '</button>',
      '<button class="btn btn--soft btn--sm" type="button" id="userDownload">' + P.esc(T('admin.download')) + '</button>',
      '<button class="btn btn--ghost btn--sm" type="button" id="userCopy">' + P.esc(T('admin.copy')) + '</button>',
      '</div>',
      '<div class="form-row"><span class="label" id="userScriptName">' + P.esc(T('admin.userScript')) + '</span>',
      '<pre class="code-box" id="userPreview"></pre></div>',
      '</div></div>',

      '<div class="panel"><div class="panel-head"><h4>' + P.esc(T('admin.userExisting')) + '</h4></div>',
      '<div class="draft-list" id="userList"></div></div>',
      '</div>'
    ].join('');

    var getEl = function (id) { return P.qs('#' + id); };
    var touched = false;

    function collectUser() {
      var links = {};
      getEl('uLinks').value.split(/\n/).forEach(function (line) {
        var i = line.indexOf('|');
        if (i > 0) links[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      });
      return {
        slug: P.slugify(getEl('uSlug').value || getEl('uName').value),
        name: getEl('uName').value.trim(),
        role: getEl('uRole').value.trim(),
        bio: getEl('uBio').value.trim(),
        avatar: getEl('uAvatar').value.trim(),
        email: getEl('uEmail').value.trim(),
        links: links
      };
    }
    function updatePreview() {
      var u = collectUser();
      P.qs('#userScriptName').textContent = usersDir + '/' + (u.slug || 'slug') + '.js';
      P.qs('#userPreview').innerHTML = P.publish.highlight(P.publish.buildUserFile(u));
    }
    getEl('uName').addEventListener('input', function (e) {
      if (!touched) getEl('uSlug').value = P.slugify(e.target.value);
      updatePreview();
    });
    getEl('uSlug').addEventListener('input', function () { touched = true; updatePreview(); });
    ['uRole', 'uBio', 'uAvatar', 'uEmail', 'uLinks'].forEach(function (id) {
      getEl(id).addEventListener('input', updatePreview);
    });
    updatePreview();

    P.qs('#userCreate').addEventListener('click', function () {
      var u = collectUser();
      if (!u.name) { P.toast(T('admin.userName'), 'error'); return; }
      P.download(u.slug + '.js', P.publish.buildUserFile(u));
      P.toast(T('admin.downloaded', { file: usersDir + '/' + u.slug + '.js' }), 'success');
    });
    P.qs('#userDownload').addEventListener('click', function () {
      var u = collectUser();
      P.download(u.slug + '.js', P.publish.buildUserFile(u));
    });
    P.qs('#userCopy').addEventListener('click', async function () {
      var ok = await P.copyText(P.publish.buildUserFile(collectUser()));
      P.toast(ok ? T('admin.copy') : T('admin.copyFailed'), ok ? 'success' : 'error');
    });

    var list = Object.keys(P.Store.users).map(function (k) {
      var u = P.getUser(k);
      var n = P.postsByAuthor(k).length;
      return '<div class="draft-item"><span style="flex:1;min-width:0"><b>' + P.esc(u.name) + '</b><br><small class="muted">' +
        P.esc(usersDir + '/' + k + '.js') + ' · ' + n + ' ' + P.esc(T('admin.userPosts')) + '</small></span>' +
        '<button class="icon-btn" type="button" data-edit-user="' + P.esc(k) + '" title="' + P.esc(T('admin.edit')) + '">' + P.icon('pen', 15) + '</button></div>';
    }).join('');
    P.qs('#userList').innerHTML = list || '<span class="muted" style="font-size:.84rem">—</span>';
    P.qs('#userList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-edit-user]');
      if (!b) return;
      var u = P.Store.users[b.getAttribute('data-edit-user')];
      if (!u) return;
      getEl('uName').value = u.name || '';
      getEl('uSlug').value = u.slug || '';
      getEl('uRole').value = u.role || '';
      getEl('uBio').value = u.bio || '';
      getEl('uAvatar').value = u.avatar || '';
      getEl('uEmail').value = u.email || '';
      getEl('uLinks').value = Object.keys(u.links || {}).map(function (k) { return k + ' | ' + u.links[k]; }).join('\n');
      touched = true;
      P.qs('#userFormTitle').textContent = T('admin.userUpdate');
      updatePreview();
    });
  }

  /* ---------------------------------------------------------- appearance */
  function appearanceState() {
    var rt = window.PREPORTAL_RUNTIME || {};
    return {
      customCss: read(LS.css, rt.customCss || ''),
      customJs: read(LS.js, rt.customJs || ''),
      headHtml: read(LS.head, rt.headHtml || ''),
      ads: read(LS.ads, (rt.ads && rt.ads) || { enabled: false, slots: [] })
    };
  }

  /* ---------------------------------------------------------- appearance & ads (merged) */
  function renderAppearanceAds(host) {
    var rt = appearanceState();
    var adState = rt.ads || { enabled: false, slots: [] };
    adState.slots = adState.slots || [];
    var slots = ['header', 'sidebar', 'inline', 'footer'];
    var slotLabel = { header: 'admin.adSlotHeader', sidebar: 'admin.adSlotSidebar', inline: 'admin.adSlotInline', footer: 'admin.adSlotFooter' };

    host.innerHTML = [
      '<div class="panel"><div class="panel-head"><h4>' + P.esc(T('admin.appearanceAdsTitle')) + '</h4></div>',
      '<p class="muted" style="font-size:.82rem;margin:0 0 12px">' + P.esc(T('admin.appearanceAdsHelp')) + '</p>',

      '<div class="admin-form"><label class="label">' + P.esc(T('admin.cssTitle')) + '</label>' +
      '<textarea class="textarea input" id="edCss" rows="10" spellcheck="false" style="font-family:var(--mono)">' + P.esc(rt.customCss) + '</textarea></div>',

      '<div class="admin-form"><label class="label">' + P.esc(T('admin.jsTitle')) + '</label>' +
      '<textarea class="textarea input" id="edJs" rows="8" spellcheck="false" style="font-family:var(--mono)">' + P.esc(rt.customJs) + '</textarea></div>',

      '<div class="admin-form"><label class="label">' + P.esc(T('admin.headTitle')) + '</label>' +
      '<textarea class="textarea input" id="edHead" rows="5" spellcheck="false" style="font-family:var(--mono)">' + P.esc(rt.headHtml) + '</textarea></div>',

      '<div class="admin-form"><div class="panel-head" style="padding:8px 0"><h4 style="font-size:1rem">' + P.esc(T('admin.navAds')) + '</h4></div>',
      '<label style="display:flex;align-items:center;gap:8px;font-size:.86rem;margin-bottom:8px"><input type="checkbox" id="adEnabled"' + (adState.enabled ? ' checked' : '') + '> ' + P.esc(T('admin.adEnabled')) + '</label>',
      '<div class="slot-tabs">' + slots.map(function (s) {
        return '<button class="chip ' + (s === 'header' ? 'is-active' : '') + '" type="button" data-slot-tab="' + s + '">' + P.esc(T(slotLabel[s])) + '</button>';
      }).join('') + '</div>',
      '<div id="adEditor"></div>',
      '<div style="display:flex;gap:8px;margin-top:10px">' +
      '<button class="btn btn--primary btn--sm" type="button" id="adAdd">' + P.esc(T('admin.adAdd')) + '</button>' +
      '</div>',
      '</div>',

      '<div class="panel" style="margin-top:16px"><div class="panel-head"><h4>data/runtime.js</h4>' +
      '<div style="display:flex;gap:6px">' +
      '<button class="btn btn--primary btn--sm" type="button" id="rtDownload">' + P.esc(T('admin.download')) + '</button>' +
      '<button class="btn btn--ghost btn--sm" type="button" id="rtCopy">' + P.esc(T('admin.copy')) + '</button>' +
      '</div></div>' +
      '<pre class="code-box" id="rtPreview"></pre></div>'
    ].join('');

    var activeSlot = 'header';

    /* Tek runtime.js önizlemesi — tüm alanlar ortak */
    function paint() {
      var full = {
        customCss: P.qs('#edCss').value,
        customJs: P.qs('#edJs').value,
        headHtml: P.qs('#edHead').value,
        ads: { enabled: P.qs('#adEnabled').checked, slots: adState.slots }
      };
      P.qs('#rtPreview').innerHTML = P.publish.highlight(P.publish.buildRuntimeFile(full));
    }

    /* Anında kaydet — her değişiklik localStorage'a yazılır */
    function save() {
      write(LS.css, P.qs('#edCss').value);
      write(LS.js, P.qs('#edJs').value);
      write(LS.head, P.qs('#edHead').value);
      write(LS.ads, { enabled: P.qs('#adEnabled').checked, slots: adState.slots });
    }

    /* CSS / JS / Head — anında kaydet + önizleme */
    ['#edCss', '#edJs', '#edHead'].forEach(function (s) {
      P.qs(s).addEventListener('input', function () { save(); paint(); });
    });

    /* Ads */
    P.qs('#adEnabled').addEventListener('change', function (e) {
      adState.enabled = e.target.checked;
      save();
      paint();
    });

    function renderAdEditor() {
      var list = adState.slots.filter(function (a) { return a.slot === activeSlot; });
      P.qs('#adEditor').innerHTML = list.length ? list.map(function (a) {
        var idx = adState.slots.indexOf(a);
        return '<div class="ad-item" data-idx="' + idx + '">' +
          '<div class="ad-item__head"><b>' + P.esc(a.name || T(slotLabel[activeSlot])) + '</b>' +
          '<button class="icon-btn" type="button" data-del-ad="' + idx + '" title="' + P.esc(T('actions.remove')) + '">' + P.icon('close', 15) + '</button></div>' +
          '<div class="form-row"><label class="label">' + P.esc(T('admin.adName')) + '</label><input class="input" data-ad-field="name" type="text" value="' + P.esc(a.name || '') + '"></div>' +
          '<div class="form-row"><label class="label">' + P.esc(T('admin.adCode')) + '</label><textarea class="input" data-ad-field="code" rows="4" spellcheck="false" style="font-family:var(--mono);font-size:.8rem">' + P.esc(a.code || '') + '</textarea></div>' +
          '<div class="form-row"><label class="label">' + P.esc(T('admin.adScripts')) + '</label><textarea class="input" data-ad-field="scripts" rows="2" spellcheck="false" style="font-family:var(--mono);font-size:.8rem">' + P.esc((a.scripts || []).join('\n')) + '</textarea></div>' +
          '</div>';
      }).join('') : '<div class="ad-empty">' + P.icon('megaphone', 20) + '<span>' + P.esc(T('admin.adEmpty')) + '</span></div>';

      P.qsa('[data-ad-field]', host).forEach(function (el) {
        el.addEventListener('input', function () {
          var box = el.closest('[data-idx]');
          var idx = Number(box.getAttribute('data-idx'));
          var field = el.getAttribute('data-ad-field');
          if (!adState.slots[idx]) return;
          if (field === 'scripts') adState.slots[idx].scripts = el.value.split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean);
          else adState.slots[idx][field] = el.value;
          save();
          paint();
        });
      });
      P.qsa('[data-del-ad]', host).forEach(function (b) {
        b.addEventListener('click', function () {
          adState.slots.splice(Number(b.getAttribute('data-del-ad')), 1);
          save();
          renderAdEditor();
          paint();
        });
      });
    }

    P.qsa('[data-slot-tab]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        activeSlot = b.getAttribute('data-slot-tab');
        P.qsa('[data-slot-tab]', host).forEach(function (x) { x.classList.toggle('is-active', x === b); });
        renderAdEditor();
      });
    });

    P.qs('#adAdd').addEventListener('click', function () {
      adState.slots.push({ id: activeSlot + '-' + Date.now().toString(36), slot: activeSlot, name: T(slotLabel[activeSlot]), enabled: true, code: '', scripts: [] });
      save();
      renderAdEditor();
      paint();
    });

    P.qs('#rtDownload').addEventListener('click', function () {
      var full = {
        customCss: P.qs('#edCss').value,
        customJs: P.qs('#edJs').value,
        headHtml: P.qs('#edHead').value,
        ads: { enabled: P.qs('#adEnabled').checked, slots: adState.slots }
      };
      P.download('runtime.js', P.publish.buildRuntimeFile(full));
      P.toast(T('admin.downloaded', { file: 'data/runtime.js' }), 'success');
    });
    P.qs('#rtCopy').addEventListener('click', async function () {
      var full = {
        customCss: P.qs('#edCss').value,
        customJs: P.qs('#edJs').value,
        headHtml: P.qs('#edHead').value,
        ads: { enabled: P.qs('#adEnabled').checked, slots: adState.slots }
      };
      var ok = await P.copyText(P.publish.buildRuntimeFile(full));
      P.toast(ok ? T('admin.copy') : T('admin.copyFailed'), ok ? 'success' : 'error');
    });

    renderAdEditor();
    paint();
  }

  /* ---------------------------------------------------------- settings */
  function renderSettings(host) {
    var cfg = P.CFG;
    var val = function (k, d) { return cfg[k] != null ? cfg[k] : d; };

    host.innerHTML = [
      '<div class="panel"><div class="panel-head"><h4>' + P.esc(T('admin.navSettings')) + '</h4>',
      '<div style="display:flex;gap:6px">',
      '<button class="btn btn--primary btn--sm" type="button" id="stDownload">' + P.esc(T('admin.exportSettings')) + '</button>',
      '<button class="btn btn--ghost btn--sm" type="button" id="stCopy">' + P.esc(T('admin.copy')) + '</button>',
      '</div></div>',
      '<div class="admin-form">',
      row('stSiteName', 'admin.settingSite', 'text', '', '', val('siteName', '')),
      row('stSiteUrl', 'admin.settingUrl', 'text', '', '', val('siteUrl', '')),
      row('stDesc', 'admin.settingDesc', 'textarea', '', '', val('description', '')),
      '<div class="admin-grid-2 admin-grid-2--tight">',
      row('stPerPage', 'admin.settingPerPage', 'number', '', '', val('perPage', 12)),
      row('stLangs', 'admin.settingLangs', 'text', '', '', (cfg.langs || []).join(', ')),
      '</div>',
      '<div class="admin-grid-2 admin-grid-2--tight">',
      row('stDisqus', 'admin.settingDisqus', 'text', '', '', (cfg.disqus && cfg.disqus.shortname) || ''),
      '<div class="form-row"><label class="label" for="stDisqusId">' + P.esc(T('admin.settingDisqusId')) + '</label>' +
      '<div class="select-wrap"><select class="select" id="stDisqusId">' +
      ['url', 'slug'].map(function (v) { return '<option value="' + v + '"' + (((cfg.disqus && cfg.disqus.pageIdentifier) || 'url') === v ? ' selected' : '') + '>' + v + '</option>'; }).join('') +
      '</select></div></div>',
      '</div>',
      '<div class="admin-grid-2 admin-grid-2--tight">',
      row('stTg', 'social.telegram', 'text', '', '', (cfg.social && cfg.social.telegram) || ''),
      row('stX', 'social.x', 'text', '', '', (cfg.social && cfg.social.x) || ''),
      row('stGh', 'social.github', 'text', '', '', (cfg.social && cfg.social.github) || ''),
      row('stRss', 'social.rss', 'text', '', '', (cfg.social && cfg.social.rss) || ''),
      '</div>',
      '<div style="display:flex;gap:8px;flex-wrap:wrap">',
      '<button class="btn btn--soft btn--sm" type="button" id="stSave">' + P.esc(T('admin.saveLocal')) + '</button>',
      '<button class="btn btn--ghost btn--sm" type="button" id="stReset">' + P.esc(T('admin.reset')) + '</button>',
      '</div>',
      '<pre class="code-box" id="stPreview"></pre>',
      '</div></div>'
    ].join('');

    var collect = function () {
      return {
        siteName: P.qs('#stSiteName').value,
        siteUrl: P.qs('#stSiteUrl').value,
        description: P.qs('#stDesc').value,
        langs: P.qs('#stLangs').value,
        perPage: P.qs('#stPerPage').value,
        disqus: { shortname: P.qs('#stDisqus').value, pageIdentifier: P.qs('#stDisqusId').value },
        social: { telegram: P.qs('#stTg').value, x: P.qs('#stX').value, github: P.qs('#stGh').value, rss: P.qs('#stRss').value },
        media: cfg.media || {},
        logo: cfg.logo,
        postsDir: cfg.postsDir,
        usersDir: cfg.usersDir,
        categoryDir: cfg.categoryDir,
        mediaDir: cfg.mediaDir,
        langDir: cfg.langDir,
        intro: cfg.intro
      };
    };
    var paint = function () {
      P.qs('#stPreview').innerHTML = P.publish.highlight(P.publish.buildConfigFile(collect()));
    };
    P.qsa('.admin-form input, .admin-form textarea, .admin-form select', host).forEach(function (el) {
      el.addEventListener('input', paint);
      el.addEventListener('change', paint);
    });
    paint();

    P.qs('#stSave').addEventListener('click', function () {
      P.toast(T('admin.savedLocal'), 'success');
    });
    P.qs('#stReset').addEventListener('click', function () {
      renderSettings(host);
    });
    P.qs('#stDownload').addEventListener('click', function () {
      P.download('config.js', P.publish.buildConfigFile(collect()));
      P.toast(T('admin.downloaded', { file: 'data/config.js' }), 'success');
    });
    P.qs('#stCopy').addEventListener('click', async function () {
      var ok = await P.copyText(P.publish.buildConfigFile(collect()));
      P.toast(ok ? T('admin.copy') : T('admin.copyFailed'), ok ? 'success' : 'error');
    });
  }

  /* ---------------------------------------------------------- publish keys */
  function renderSecurity(host) {
    var keys = read(LS.keys, { token: '', owner: '', repo: '', branch: 'main' });
    var media = P.CFG.media || {};
    host.innerHTML = [
      '<div class="panel"><div class="panel-head"><h4>' + P.esc(T('admin.navSecurity')) + '</h4></div>',
      '<p class="muted" style="font-size:.82rem;margin:0 0 12px">' + P.esc(T('admin.ghHelp')) + '</p>',
      '<div class="admin-form">',
      '<div class="admin-grid-2 admin-grid-2--tight">',
      row('ghOwner', 'admin.ghOwner', 'text', '', '', keys.owner || media.githubOwner || ''),
      row('ghRepo', 'admin.ghRepo', 'text', '', '', keys.repo || media.githubRepo || ''),
      row('ghBranch', 'admin.ghBranch', 'text', '', '', keys.branch || media.githubBranch || 'main'),
      row('ghToken', 'admin.ghToken', 'password', '', '', keys.token || ''),
      '</div>',
      '<div style="display:flex;gap:8px;flex-wrap:wrap">',
      '<button class="btn btn--soft btn--sm" type="button" id="ghSave">' + P.esc(T('admin.saveLocal')) + '</button>',
      '<button class="btn btn--ghost btn--sm" type="button" id="ghClear">' + P.esc(T('admin.reset')) + '</button>',
      '</div>',
      '<div class="form-row"><button class="btn btn--primary" type="button" id="ghTest">' + P.esc(T('admin.publishNow')) + '</button>',
      '<span id="ghResult" class="hint"></span></div>',
      '</div></div>'
    ].join('');

    P.qs('#ghSave').addEventListener('click', function () {
      write(LS.keys, {
        token: P.qs('#ghToken').value.trim(),
        owner: P.qs('#ghOwner').value.trim(),
        repo: P.qs('#ghRepo').value.trim(),
        branch: P.qs('#ghBranch').value.trim() || 'main'
      });
      P.toast(T('admin.savedLocal'), 'success');
    });
    P.qs('#ghClear').addEventListener('click', function () {
      try { localStorage.removeItem(LS.keys); } catch (e) { }
      renderSecurity(host);
    });
    P.qs('#ghTest').addEventListener('click', async function () {
      var out = P.qs('#ghResult');
      var k = { token: P.qs('#ghToken').value.trim(), owner: P.qs('#ghOwner').value.trim(), repo: P.qs('#ghRepo').value.trim(), branch: P.qs('#ghBranch').value.trim() || 'main' };
      if (!k.token || !k.owner || !k.repo) { out.textContent = T('admin.publishFailed', { msg: 'token / owner / repo' }); return; }
      out.textContent = T('admin.publishing');
      try {
        var r = await fetch('https://api.github.com/repos/' + k.owner + '/' + k.repo, {
          headers: { Authorization: 'Bearer ' + k.token, Accept: 'application/vnd.github+json' }
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var j = await r.json();
        out.textContent = '✓ ' + j.full_name + ' · ' + (j.default_branch || k.branch);
      } catch (e) {
        out.textContent = T('admin.publishFailed', { msg: e.message });
      }
    });
  }

  /* ---------------------------------------------------------- helpers */
  function row(id, labelKey, type, ph, cls, value) {
    var input;
    if (type === 'textarea') {
      input = '<textarea class="textarea input" id="' + id + '" rows="3" placeholder="' + P.esc(ph || '') + '">' + P.esc(value || '') + '</textarea>';
    } else {
      input = '<input class="input' + (cls === 'mono' ? ' mono' : '') + '" id="' + id + '" type="' + type + '" placeholder="' + P.esc(ph || '') + '" value="' + P.esc(value == null ? '' : value) + '">';
    }
    return '<div class="form-row"><label class="label" for="' + id + '">' + P.esc(T(labelKey)) + '</label>' + input + '</div>';
  }
})();

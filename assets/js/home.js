/* =====================================================================
   PrePortal — home page (catalog first, 5play style)
   Category tabs + search + sort + pagination, all client side.
   ===================================================================== */
(function () {
  var P = window.PrePortal;
  var T = P.t;

  var state = { q: '', cat: '', sort: 'new', page: 1 };
  var redraw = null;   /* dil değişince tüm sayfayı yeniden çizer */

  document.addEventListener('preportal:ready', async function () {
    if (window.PP_I18N && window.PP_I18N.whenReady) { try { await window.PP_I18N.whenReady(); } catch (e) { } }
    var grid = P.qs('#homePosts');
    if (!grid) return;

    var cats = P.categoriesWithCount();
    var posts = P.publishedPosts();
    state.cat = P.param('cat') || '';

    var head = P.qs('#homeTitle');
    var sub = P.qs('#homeSub');

    function paintHead() {
      if (head) head.textContent = state.cat ? P.getCategory(state.cat).name : T('home.latestTitle');
      if (sub) sub.textContent = T('home.latestSub');
    }

    paintHead();
    buildTabs(cats);
    buildCategories(cats);
    buildRecent();
    wire();
    render();

    /* dil değiştiğinde her şey anında yeniden çizilir (sayfa yenilemek yok) */
    redraw = function () {
      cats = P.categoriesWithCount();
      posts = P.publishedPosts();
      paintHead();
      buildTabs(cats);
      buildCategories(cats);
    buildRecent();
      wire();
      render();
    };

    /* ---------- category tabs ---------- */
    function buildTabs(list) {
      var host = P.qs('#homeCatTabs');
      if (!host) return;
      var all = '<a class="cat-tab is-active" href="index.html" data-cat=""><span>' + P.esc(T('catalog.filterAll')) + '</span><small>' + P.num(posts.length) + '</small></a>';
      host.innerHTML = all + list.map(function (c) {
        return '<a class="cat-tab" href="index.html?cat=' + encodeURIComponent(c.slug) + '" data-cat="' + P.esc(c.slug) + '">' +
          '<span>' + P.esc(c.name) + '</span><small>' + P.num(c.count) + '</small></a>';
      }).join('');

      setActive(state.cat);
      /* tek dinleyici (yeniden çizimde çoğalmasın) */
      if (host.dataset.bound === '1') return;
      host.dataset.bound = '1';
      host.addEventListener('click', function (e) {
        var a = e.target.closest('[data-cat]');
        if (!a) return;
        /* plain links keep working (middle click, new tab); we just avoid a reload */
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        state.cat = a.getAttribute('data-cat') || '';
        state.page = 1;
        setActive(state.cat);
        paintHead();
        render();
      });
    }

    function setActive(slug) {
      P.qsa('#homeCatTabs [data-cat]').forEach(function (a) {
        a.classList.toggle('is-active', (a.getAttribute('data-cat') || '') === (slug || ''));
      });
    }

    /* ---------- category strip ---------- */
    function buildCategories(list) {
      var host = P.qs('#homeCategories');
      if (!host) return;
      host.innerHTML = list.length ? list.slice(0, 8).map(function (c) {
        return [
          '<a class="cat-card" href="category.html?cat=' + encodeURIComponent(c.slug) + '" data-reveal>',
          '<span class="cat-card__icon">' + P.icon(c.icon || 'folder', 21) + '</span>',
          '<h3>' + P.esc(c.name) + '</h3>',
          '<p>' + P.esc(P.truncate(c.description || '', 74)) + '</p>',
          '<span class="cat-card__count">' + P.esc(T('categories.count', { n: c.count })) + '</span>',
          '</a>'
        ].join('');
      }).join('') : P.emptyState(T('home.noCategories'), T('home.noCategoriesText'));
    }

    function buildRecent() {
      var host = P.qs('#journalRecent');
      if (!host) return;
      host.innerHTML = sortList(posts, 'new').slice(0, 4).map(function (p) {
        return '<a class="journal-recent" href="post.html?slug=' + encodeURIComponent(p.slug) + '">' +
          '<small>' + P.esc(P.formatDate(p.date)) + '</small><strong>' + P.esc(p.title) + '</strong></a>';
      }).join('');
    }

    /* ---------- controls ---------- */
    function wire() {
      if (wire.done) return;
      wire.done = true;
      var search = P.qs('#homeSearch');
      var sort = P.qs('#homeSort');

      if (search) {
        state.q = P.param('q') || '';
        search.value = state.q;
        var timer;
        search.addEventListener('input', function () {
          clearTimeout(timer);
          timer = setTimeout(function () { state.q = search.value.trim(); state.page = 1; render(); }, 140);
        });
      }
      if (sort) {
        state.sort = P.param('sort') || 'new';
        sort.value = state.sort;
        sort.addEventListener('change', function () { state.sort = sort.value; state.page = 1; render(); });
      }
    }

    /* ---------- render ---------- */
    function render() {
      var list = state.q ? P.searchPosts(state.q) : posts.slice();
      if (state.cat) list = list.filter(function (p) { return p.category === state.cat; });
      list = sortList(list, state.sort);

      var per = P.CFG.perPage || 12;
      var total = Math.max(1, Math.ceil(list.length / per));
      if (state.page > total) state.page = total;
      var slice = list.slice((state.page - 1) * per, state.page * per);

      grid.innerHTML = slice.length
        ? slice.map(function (p, i) { return P.postCard(p, i === 0 && state.page === 1 && !state.q && !state.cat && state.sort === 'new' ? 'journal-lead' : ''); }).join('')
        : P.emptyState(T('catalog.emptyTitle'), T('catalog.emptyText'),
          '<a class="btn btn--soft" href="index.html">' + P.esc(T('catalog.emptyAction')) + '</a>');

      var pager = P.qs('#homePager');
      if (pager) {
        pager.innerHTML = list.length > per ? pagerHTML(state.page, total) : '';
        P.qsa('[data-page]', pager).forEach(function (b) {
          b.addEventListener('click', function () {
            state.page = Number(b.getAttribute('data-page'));
            render();
            var top = P.qs('#latest');
            if (top) window.scrollTo({ top: Math.max(0, top.offsetTop - 70), behavior: 'smooth' });
          });
        });
      }

      var cnt = P.qs('#homeCount');
      if (cnt) cnt.textContent = T('categories.count', { n: list.length });

      P.reveal();
      syncURL();
    }

    document.addEventListener('preportal:lang', function () { if (redraw) redraw(); });

    function syncURL() {
      if (location.protocol === 'file:') return;
      var u = new URLSearchParams();
      if (state.q) u.set('q', state.q);
      if (state.cat) u.set('cat', state.cat);
      if (state.sort && state.sort !== 'new') u.set('sort', state.sort);
      var s = u.toString();
      try { history.replaceState(null, '', (s ? '?' + s : location.pathname) + location.hash); } catch (e) { }
    }
  });

  function sortList(list, sort) {
    var arr = list.slice();
    var loc = (window.PP_I18N && window.PP_I18N.meta().intl) || 'en';
    switch (sort) {
      case 'old': arr.sort(function (a, b) { return new Date(a.date) - new Date(b.date); }); break;
      case 'az': arr.sort(function (a, b) { return a.title.localeCompare(b.title, loc); }); break;
      case 'za': arr.sort(function (a, b) { return b.title.localeCompare(a.title, loc); }); break;
      case 'read': arr.sort(function (a, b) { return P.readingTime(b.content) - P.readingTime(a.content); }); break;
      default: arr.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    }
    return arr;
  }

  function pagerHTML(page, total) {
    var out = ['<div class="pager">'];
    out.push('<button class="btn btn--ghost btn--sm" type="button" data-page="' + Math.max(1, page - 1) + '"' + (page === 1 ? ' disabled' : '') + '>' + P.icon('arrowLeft', 14) + '</button>');
    for (var i = 1; i <= total; i++) {
      if (total > 9 && i !== 1 && i !== total && Math.abs(i - page) > 1) {
        if (i === 2 || i === total - 1) out.push('<span class="muted" style="align-self:center">…</span>');
        continue;
      }
      out.push('<button class="btn ' + (i === page ? 'btn--primary' : 'btn--ghost') + ' btn--sm" type="button" data-page="' + i + '">' + i + '</button>');
    }
    out.push('<button class="btn btn--ghost btn--sm" type="button" data-page="' + Math.min(total, page + 1) + '"' + (page === total ? ' disabled' : '') + '>' + P.icon('arrowRight', 14) + '</button>');
    out.push('</div>');
    return out.join('');
  }
})();

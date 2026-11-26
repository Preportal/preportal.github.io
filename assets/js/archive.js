/* =====================================================================
   PrePortal — archive (blog.html, apps.html, games.html, category.html)
   Search + category + tag + sort + pagination, all client side.
   ===================================================================== */
(function () {
  var P = window.PrePortal;
  var T = P.t;
  var state = { q: '', cat: '', tag: '', sort: 'new', page: 1 };

  document.addEventListener('preportal:ready', async function () {
    /* ilk çizim doğru dilde olsun */
    if (window.PP_I18N && window.PP_I18N.whenReady) { try { await window.PP_I18N.whenReady(); } catch (e) { } }
    /* category.html'de #archiveGrid yoktur — kontrol sırası önemli */
    var isCategoryPage = document.body.getAttribute('data-page') === 'category';
    if (isCategoryPage) { initCategoryPage(); return; }

    var grid = P.qs('#archiveGrid');
    if (!grid) return;

    var fixedCat = grid.getAttribute('data-fixed-cat') || '';

    state.cat = fixedCat || P.param('cat') || '';
    state.tag = P.param('tag') || '';
    state.q = P.param('q') || '';

    var searchEl = P.qs('#archiveSearch');
    var catEl = P.qs('#archiveCat');
    var sortEl = P.qs('#archiveSort');
    var tagsEl = P.qs('#archiveTags');
    var pagerEl = P.qs('#archivePager');
    var resetEl = P.qs('#archiveReset');

    if (searchEl) {
      searchEl.value = state.q;
      searchEl.setAttribute('placeholder', T('catalog.searchPlaceholder'));
    }

    if (catEl && !fixedCat) {
      catEl.innerHTML = '<option value="">' + P.esc(T('catalog.allCategories')) + '</option>' + P.categoriesWithCount().map(function (c) {
        return '<option value="' + P.esc(c.slug) + '">' + P.esc(c.name) + ' (' + c.count + ')</option>';
      }).join('');
      catEl.value = state.cat;
    } else if (catEl) {
      catEl.parentNode.style.display = 'none';
    }

    if (sortEl) {
      var labels = { new: 'catalog.sortNew', old: 'catalog.sortOld', az: 'catalog.sortAz', za: 'catalog.sortZa', read: 'catalog.sortRead' };
      Array.prototype.forEach.call(sortEl.options, function (o) {
        if (labels[o.value]) o.textContent = T(labels[o.value]);
      });
      sortEl.value = state.sort;
    }

    if (tagsEl) {
      var tags = P.allTags().slice(0, 16);
      tagsEl.innerHTML = tags.length ? tags.map(function (t) {
        return '<button class="chip' + (state.tag === t.tag ? ' is-active' : '') + '" type="button" data-tag="' + P.esc(t.tag) + '">' + P.esc(t.tag) + ' <small>' + t.count + '</small></button>';
      }).join('') : '';
      tagsEl.addEventListener('click', function (e) {
        var b = e.target.closest('[data-tag]');
        if (!b) return;
        state.tag = state.tag === b.getAttribute('data-tag') ? '' : b.getAttribute('data-tag');
        state.page = 1;
        P.qsa('.chip', tagsEl).forEach(function (c) { c.classList.toggle('is-active', c.getAttribute('data-tag') === state.tag); });
        render();
      });
    }

    if (searchEl) {
      var t;
      searchEl.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { state.q = searchEl.value.trim(); state.page = 1; render(); }, 140);
      });
    }
    if (catEl) catEl.addEventListener('change', function () { state.cat = catEl.value; state.page = 1; render(); });
    if (sortEl) sortEl.addEventListener('change', function () { state.sort = sortEl.value; render(); });
    if (resetEl) resetEl.addEventListener('click', function () {
      state = { q: '', cat: fixedCat || '', tag: '', sort: 'new', page: 1 };
      if (searchEl) searchEl.value = '';
      if (catEl) catEl.value = fixedCat || '';
      if (sortEl) sortEl.value = 'new';
      if (tagsEl) P.qsa('.chip', tagsEl).forEach(function (c) { c.classList.remove('is-active'); });
      render();
    });

    function render() {
      var list = P.searchPosts(state.q);
      if (state.cat) list = list.filter(function (p) { return p.category === state.cat; });
      if (state.tag) list = list.filter(function (p) { return p.tags.indexOf(state.tag) !== -1; });

      list = sortList(list, state.sort);

      var per = (P.CFG.perPage || 12);
      var total = Math.max(1, Math.ceil(list.length / per));
      if (state.page > total) state.page = total;
      var slice = list.slice((state.page - 1) * per, state.page * per);

      grid.innerHTML = slice.length
        ? slice.map(function (p) { return P.postCard(p); }).join('')
        : P.emptyState(T('catalog.emptyTitle'), T('catalog.emptyText'),
          '<button class="btn btn--soft" type="button" data-empty-reset>' + P.esc(T('catalog.emptyAction')) + '</button>');
      var er = P.qs('[data-empty-reset]', grid);
      if (er) er.addEventListener('click', function () { if (resetEl) resetEl.click(); });

      if (pagerEl) {
        pagerEl.innerHTML = list.length > per ? pagerHTML(state.page, total) : '';
        P.qsa('[data-page]', pagerEl).forEach(function (b) {
          b.addEventListener('click', function () {
            state.page = Number(b.getAttribute('data-page'));
            render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          });
        });
      }
      P.reveal();
      syncURL();
    }

    function syncURL() {
      var u = new URLSearchParams();
      if (state.q) u.set('q', state.q);
      if (state.cat && !fixedCat) u.set('cat', state.cat);
      if (state.tag) u.set('tag', state.tag);
      var s = u.toString();
      if (location.protocol === 'file:') return;
      try { history.replaceState(null, '', s ? '?' + s : location.pathname); } catch (e) { }
    }

    render();

    /* dil değişince arşiv de anında yenilenir */
    document.addEventListener('preportal:lang', function () {
      if (searchEl) searchEl.setAttribute('placeholder', T('catalog.searchPlaceholder'));
      if (catEl && !fixedCat) {
        var keepCat = catEl.value;
        catEl.innerHTML = '<option value="">' + P.esc(T('catalog.allCategories')) + '</option>' + P.categoriesWithCount().map(function (c) {
          return '<option value="' + P.esc(c.slug) + '">' + P.esc(c.name) + ' (' + c.count + ')</option>';
        }).join('');
        catEl.value = keepCat;
      }
      if (sortEl) {
        var keepSort = sortEl.value;
        Array.prototype.forEach.call(sortEl.options, function (o) {
          var key = o.value;
          if (!key) return;
          var label = T('catalog.sort' + key.charAt(0).toUpperCase() + key.slice(1));
          if (label && label.indexOf('catalog.sort') !== 0) o.textContent = label;
        });
        sortEl.value = keepSort;
      }
      render();
    });
  });

  /* ---------------- category page ---------------- */
  function initCategoryPage() {
    var grid = P.qs('#catGrid');
    var catHeroEl = P.qs('#catHero');
    var listEl = P.qs('#catPosts');
    var sectionEl = P.qs('#catPostsSection');
    var slugNow = P.param('cat');
    var activeTag = P.param('tag') || '';

    /* dil değişince kategori sayfası da anında yenilenir */
    document.addEventListener('preportal:lang', function () { renderCategoryPage(); });

    renderCategoryPage();

    function renderCategoryPage() {
    var cats = P.categoriesWithCount();
    /* hero varsayılan metinlere geri döner (önceki dil kalmasın) */
    if (catHeroEl && !slugNow) {
      catHeroEl.innerHTML = '<span class="eyebrow">' + P.esc(T('categories.eyebrow')) + '</span>' +
        '<h1>' + P.esc(T('categories.title')) + '</h1>' +
        '<p>' + P.esc(T('categories.lead')) + '</p>';
    }
    grid.innerHTML = cats.length ? cats.map(function (c) {
      return [
        '<a class="cat-card" href="category.html?cat=' + encodeURIComponent(c.slug) + '" data-reveal>',
        '<span class="cat-card__icon">' + P.icon(c.icon || 'folder', 21) + '</span>',
        '<h3>' + P.esc(c.name) + '</h3>',
        '<p>' + P.esc(c.description || '') + '</p>',
        '<span class="cat-card__count">' + P.esc(T('categories.count', { n: c.count })) + '</span>',
        '</a>'
      ].join('');
    }).join('') : P.emptyState(T('categories.noCategories'), T('categories.noCategoriesText'));

    var slug = P.param('cat');
    var section = P.qs('#catPostsSection');
    var list = P.qs('#catPosts');

    if (slug) {
      var cat = P.getCategory(slug);
      if (!cat || !cat.slug) cat = { slug: slug, name: slug, description: '', icon: 'folder' };
      var posts = P.postsByCategory(slug);
      document.title = cat.name + ' — ' + (P.CFG.siteName || 'PrePortal');
      P.qs('#catHero').innerHTML = [
        '<span class="eyebrow">' + P.esc(T('categories.postsEyebrow')) + '</span>',
        '<h1>' + P.esc(cat.name) + '</h1>',
        '<p>' + P.esc(cat.description || T('categories.postsSub')) + '</p>',
        '<div class="filter-bar" id="catFilters"></div>',
        '<div class="chips" style="margin-top:8px">',
        '<span class="badge badge--accent">' + P.esc(T('categories.count', { n: posts.length })) + '</span>',
        '<a class="chip" href="category.html">' + P.esc(T('categories.allCategoriesLink')) + '</a>',
        '</div>'
      ].join('');
      P.qs('#catPostsTitle').textContent = T('categories.postsTitle', { name: cat.name });
      P.qs('#catPostsDesc').textContent = posts.length ? T('categories.postsSub') : '';
      var catTags = [];
      posts.forEach(function (p) { (p.tags || []).forEach(function (t) { if (catTags.indexOf(t) === -1) catTags.push(t); }); });
      activeTag = activeTag || P.param('tag') || '';
      var fHost = P.qs('#catFilters');
      if (catTags.length) {
        fHost.innerHTML = ['<button class="chip' + (activeTag ? '' : ' is-active') + '" type="button" data-ctag="">' + P.esc(T('catalog.filterAll')) + '</button>']
          .concat(catTags.map(function (t) {
            return '<button class="chip' + (activeTag === t ? ' is-active' : '') + '" type="button" data-ctag="' + P.esc(t) + '">' + P.esc(t) + '</button>';
          })).join('');
      }
      function renderCatPosts() {
        var arr = activeTag ? posts.filter(function (p) { return p.tags.indexOf(activeTag) !== -1; }) : posts;
        list.innerHTML = arr.length ? arr.map(function (p) { return P.postCard(p); }).join('')
          : P.emptyState(T('categories.noPosts'), T('categories.noPostsText'),
            '<a class="btn btn--soft" href="create.html?cat=' + encodeURIComponent(slug) + '">' + P.esc(T('categories.createPost')) + '</a>');
        P.reveal();
      }
      if (fHost) {
        fHost.onclick = function (e) {
          var b = e.target.closest('[data-ctag]');
          if (!b) return;
          activeTag = b.getAttribute('data-ctag');
          P.qsa('.chip', fHost).forEach(function (c) { c.classList.toggle('is-active', c === b); });
          renderCatPosts();
        };
      }
      renderCatPosts();
      section.hidden = false;
    } else if (sectionEl) {
      sectionEl.hidden = true;
    }
    P.reveal();
    } /* renderCategoryPage sonu */
  }

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
    var out = ['<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">'];
    out.push('<button class="btn btn--ghost btn--sm" type="button" data-page="' + Math.max(1, page - 1) + '"' + (page === 1 ? ' disabled' : '') + '>' + P.icon('arrowLeft', 14) + P.esc(T('actions.prev')) + '</button>');
    for (var i = 1; i <= total; i++) {
      if (total > 9 && i !== 1 && i !== total && Math.abs(i - page) > 1) {
        if (i === 2 || i === total - 1) out.push('<span class="muted" style="align-self:center">…</span>');
        continue;
      }
      out.push('<button class="btn ' + (i === page ? 'btn--primary' : 'btn--ghost') + ' btn--sm" type="button" data-page="' + i + '">' + i + '</button>');
    }
    out.push('<button class="btn btn--ghost btn--sm" type="button" data-page="' + Math.min(total, page + 1) + '"' + (page === total ? ' disabled' : '') + '>' + P.esc(T('actions.next')) + P.icon('arrowRight', 14) + '</button>');
    out.push('</div>');
    return out.join('');
  }
})();

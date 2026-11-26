/* =====================================================================
   PrePortal — edit tool (edit.html)
   Loads an existing p/<slug>.js into the studio form + editor,
   then rebuilds the file so it can be committed again.
   The studio itself (create.js) does the loading via ?slug=<slug>.
   ===================================================================== */
(function () {
  var P = window.PrePortal;
  var T = P.t;

  document.addEventListener('preportal:ready', function () {
    var host = P.qs('#pickList');
    if (!host) return;

    renderPicker('');

    var search = P.qs('#pickSearch');
    if (search) search.addEventListener('input', function (e) { renderPicker(e.target.value.trim()); });

    /* create.js loads the post from ?slug= — reveal the studio once it did */
    var slug = P.param('slug');
    if (slug && P.Store.posts[slug]) showStudio();
  });

  /* ---------------------------------------------------------- picker */
  function renderPicker(query) {
    var list = P.allPosts();
    if (query) list = P.searchPosts(query);
    list = list.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

    var host = P.qs('#pickList');
    host.innerHTML = list.length ? list.map(function (p) {
      var cat = P.getCategory(p.category);
      var author = P.getUser(p.author);
      return '<div class="draft-item" data-pick="' + P.esc(p.slug) + '" role="button" tabindex="0">' +
        '<span style="flex:1;min-width:0">' +
        '<b>' + P.esc(p.title) + '</b><br>' +
        '<small class="muted">' + P.esc((P.CFG.postsDir || 'p') + '/' + p.slug + '.js') + ' · ' +
        P.esc(cat.name) + ' · ' + P.esc(author.name) + ' · ' + P.esc(P.formatDate(p.date)) + '</small>' +
        '</span>' +
        '<span class="badge-soft">' + P.icon('pen', 13) + ' ' + P.esc(T('admin.edit')) + '</span>' +
        '</div>';
    }).join('') : '<span class="muted" style="font-size:.84rem">' + P.esc(T('admin.noResults')) + '</span>';

    P.qsa('[data-pick]', host).forEach(function (row) {
      var go = function () {
        var slug = row.getAttribute('data-pick');
        history.replaceState(null, '', 'edit.html?slug=' + encodeURIComponent(slug));
        location.reload();
      };
      row.addEventListener('click', go);
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });
    });
  }

  /* ---------------------------------------------------------- studio */
  function showStudio() {
    var panel = P.qs('#pickerPanel');
    if (panel) panel.hidden = true;
    var section = P.qs('#studioSection');
    if (section) section.hidden = false;

    /* the studio has its own toolbar: the extra page heading is noise here */
    var head = P.qs('#editHead');
    if (head) {
      head.innerHTML = '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<span class="eyebrow">' + P.esc(T('admin.navPosts')) + '</span>' +
        '<span class="badge-soft">' + P.icon('pen', 13) + ' ' + P.esc(T('studio.modeEdit')) + '</span>' +
        '<a class="btn btn--ghost btn--sm" style="margin-left:auto" href="admin.html#posts">' + P.esc(T('actions.back')) + '</a>' +
        '</div>';
      head.classList.remove('section-head');
      head.style.marginBottom = '0';
      head.style.padding = '0';
      head.style.minHeight = '0';
    }

    document.body.setAttribute('data-mode', 'edit');
    P.reveal();
  }
})();

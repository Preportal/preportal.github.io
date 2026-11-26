/* =====================================================================
   PrePortal — author profile (user.html?u=user)
   ===================================================================== */
(function () {
  var P = window.PrePortal;
  var T = P.t;

  document.addEventListener('preportal:ready', async function () {
    if (window.PP_I18N && window.PP_I18N.whenReady) { try { await window.PP_I18N.whenReady(); } catch (e) { } }
    var slug = P.param('u') || P.param('user');
    var hero = P.qs('#userHero');
    var grid = P.qs('#userPosts');
    if (!hero) return;

    var back = '<a class="btn btn--primary" href="blog.html">' + P.esc(T('post.backToArchive')) + '</a>';

    if (!slug) {
      hero.innerHTML = P.emptyState(T('author.missing'), T('author.missingText'), back);
      return;
    }

    var user = P.Store.users[slug];
    if (!user) {
      hero.innerHTML = P.emptyState(T('author.notFound'), T('author.notFoundText', { slug: slug }), back);
      return;
    }

    document.addEventListener('preportal:lang', function () { renderUser(); });
    renderUser();

    function renderUser() {
    var posts = P.postsByAuthor(slug);
    document.title = user.name + ' — ' + (P.CFG.siteName || 'PrePortal');

    var links = Object.keys(user.links || {}).map(function (k) {
      return '<a class="btn btn--ghost btn--sm" href="' + P.esc(user.links[k]) + '" target="_blank" rel="noopener">' + P.esc(k) + '</a>';
    }).join('');

    hero.innerHTML = [
      '<div class="author-hero" data-reveal>',
      user.avatar
        ? '<span class="author-avatar"><img src="' + P.esc(user.avatar) + '" alt=""></span>'
        : '<span class="author-avatar">' + P.esc(initials(user.name)) + '</span>',
      '<div>',
      '<span class="eyebrow">' + P.esc(T('author.eyebrow')) + '</span>',
      '<h1 style="margin:2px 0 6px">' + P.esc(user.name) + '</h1>',
      user.role ? '<span class="badge badge--ghost">' + P.esc(user.role) + '</span> ' : '',
      '<span class="badge badge--accent">' + P.esc(T('author.posts', { n: posts.length })) + '</span>',
      user.bio ? '<p class="muted" style="margin:12px 0 0;max-width:60ch">' + P.esc(user.bio) + '</p>' : '',
      links ? '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">' + links + '</div>' : '',
      '</div>',
      '</div>'
    ].join('');

    if (grid) {
      grid.innerHTML = posts.length ? posts.map(function (p) { return P.postCard(p); }).join('')
        : P.emptyState(T('author.none'), T('author.noneText'));
    }

    P.reveal();
    } /* renderUser sonu */
  });

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
  }
})();

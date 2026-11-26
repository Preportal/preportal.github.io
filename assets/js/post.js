/* =====================================================================
   PrePortal — post page (post.html?slug=...)
   All UI strings come from lang/<code>.json
   ===================================================================== */
(function () {
  var P = window.PrePortal;
  var T = P.t;

  document.addEventListener('preportal:ready', async function () {
    if (window.PP_I18N && window.PP_I18N.whenReady) { try { await window.PP_I18N.whenReady(); } catch (e) { } }
    var slug = P.param('slug') || P.param('p');
    var host = P.qs('#postRoot');
    if (!host) return;

    if (!slug) {
      renderMissing(T('post.missingSlug'), T('post.missingSlugText'));
      return;
    }

    var post = P.Store.posts[slug];
    if (!post) {
      renderMissing(T('post.notFoundTitle'), T('post.notFoundText', { slug: slug }));
      return;
    }

    renderPost();

    /* dil değişince yazı sayfası anında yenilenir (Disqus teması dahil) */
    document.addEventListener('preportal:lang', function () {
      renderPost();
      var ch = P.qs('#disqus_thread');
      P.mountDisqus(post, ch, { theme: window.PP_I18N.current(), force: true });
    });

    function renderPost() {
    var cat = P.getCategory(post.category);
    var author = P.getUser(post.author);
    var adj = P.adjacentPosts(post);
    var tags = (post.tags || []).map(function (t) {
      return '<a class="tag" href="blog.html?tag=' + encodeURIComponent(t) + '">' + P.esc(t) + '</a>';
    }).join('');

    document.title = post.title + ' — ' + (P.CFG.siteName || 'PrePortal');
    var md = P.qs('meta[name="description"]');
    if (md) md.setAttribute('content', P.truncate(post.excerpt || P.stripTags(post.content), 155));
    var ogt = P.qs('meta[property="og:title"]'); if (ogt) ogt.setAttribute('content', post.title);
    var ogi = P.qs('meta[property="og:image"]'); if (ogi && post.cover) ogi.setAttribute('content', post.cover);

    var downloads = (post.downloads || []).map(function (d, i) {
      var url = typeof d === 'string' ? d : d.url;
      var label = typeof d === 'string' ? T('actions.download') + ' ' + (i + 1) : (d.label || T('actions.download'));
      var meta = typeof d === 'object' ? [d.version, d.size].filter(Boolean).join(' · ') : '';
      return [
        '<div class="download-item">',
        P.icon('download', 20),
        '<span class="download-item__body"><b>' + P.esc(label) + '</b>' + (meta ? '<small>' + P.esc(meta) + '</small>' : '') + '</span>',
        '<a class="btn btn--primary btn--sm" href="' + P.esc(url) + '" target="_blank" rel="noopener nofollow">' + P.esc(T('actions.download')) + '</a>',
        '</div>'
      ].join('');
    }).join('');

    var specRows = [
      post.version ? '<div class="info-box"><strong>' + P.esc(T('post.version')) + '</strong><span>' + P.esc(post.version) + '</span></div>' : '',
      post.size ? '<div class="info-box"><strong>' + P.esc(T('post.size')) + '</strong><span>' + P.esc(post.size) + '</span></div>' : '',
      post.platform ? '<div class="info-box"><strong>' + P.esc(T('post.platform')) + '</strong><span>' + P.esc(post.platform) + '</span></div>' : ''
    ].join('');

    host.innerHTML = [
      '<nav class="breadcrumb">',
      '<a href="index.html">' + P.esc(T('post.breadcrumbHome')) + '</a><span class="sep">/</span>',
      '<a href="category.html?cat=' + encodeURIComponent(post.category) + '">' + P.esc(cat.name) + '</a><span class="sep">/</span>',
      '<span aria-current="page">' + P.esc(P.truncate(post.title, 48)) + '</span>',
      '</nav>',

      '<div class="grid grid--sidebar">',
      '<article>',
      '<header class="article-head">',
      '<span class="badge badge--accent">' + P.esc(cat.name) + '</span>',
      '<h1 class="article-title">' + P.esc(post.title) + '</h1>',
      post.excerpt ? '<p class="article-lead">' + P.esc(post.excerpt) + '</p>' : '',
      '<div class="article-meta">',
      '<a class="author" href="user.html?u=' + encodeURIComponent(author.slug) + '">',
      avatar(author),
      '<span><strong>' + P.esc(author.name) + '</strong>' + (author.role ? ' · ' + P.esc(author.role) : '') + '</span>',
      '</a>',
      '<span class="meta-item">' + P.icon('clock', 14) + P.esc(P.formatDate(post.date)) + '</span>',
      '<span class="meta-item">' + P.icon('book', 14) + P.esc(T('post.readingTime', { n: P.readingTime(post.content) })) + '</span>',
      '</div>',
      '</header>',

      post.cover ? '<figure class="article-cover"><a data-fancybox="cover" href="' + P.esc(post.cover) + '"><img src="' + P.esc(post.cover) + '" alt="' + P.esc(post.title) + '"></a></figure>' : '',

      specRows ? '<div class="grid grid--3" style="margin-top:22px">' + specRows + '</div>' : '',
      downloads ? '<div class="download-list">' + downloads + '</div>' : '',

      '<div class="prose" id="articleBody" style="margin-top:26px">' + post.content + '</div>',

      '<div class="article-footer">',
      '<span class="label">' + P.icon('tag', 15) + ' ' + P.esc(T('post.tags')) + '</span>',
      '<div class="tag-cloud">' + (tags || '<span class="muted" style="font-size:.84rem">' + P.esc(T('post.noTags')) + '</span>') + '</div>',
      '</div>',

      '<div class="share-row">',
      '<span class="label">' + P.icon('link', 15) + ' ' + P.esc(T('post.share')) + '</span>',
      '<button class="btn btn--ghost btn--sm" type="button" id="shareCopy">' + P.icon('copy', 15) + P.esc(T('post.copyLink')) + '</button>',
      '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://x.com/intent/post?text=' + encodeURIComponent(post.title) + '&url=' + encodeURIComponent(location.href) + '">X</a>',
      '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://t.me/share/url?url=' + encodeURIComponent(location.href) + '&text=' + encodeURIComponent(post.title) + '">Telegram</a>',
      '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://api.whatsapp.com/send?text=' + encodeURIComponent(post.title + ' ' + location.href) + '">WhatsApp</a>',
      '</div>',

      '<nav class="post-nav">',
      adj.next ? '<a class="next" href="post.html?slug=' + encodeURIComponent(adj.next.slug) + '"><small>' + P.esc(T('post.nextPost')) + '</small><b>' + P.esc(adj.next.title) + '</b></a>' : '<span></span>',
      adj.prev ? '<a href="post.html?slug=' + encodeURIComponent(adj.prev.slug) + '"><small>' + P.esc(T('post.prevPost')) + '</small><b>' + P.esc(adj.prev.title) + '</b></a>' : '<span></span>',
      '</nav>',

      '<section aria-labelledby="commentsTitle">',
      '<h2 id="commentsTitle" style="font-size:1.2rem;margin:40px 0 14px">' + P.esc(T('post.comments')) + '</h2>',
      '<div class="ad-slot" data-ad="inline" hidden></div>',
      '<div id="disqus_thread"></div>',
      '</section>',
      '</article>',

      '<aside class="sidebar">',
      '<div class="panel"><h4>' + P.esc(T('post.author')) + '</h4>',
      '<a class="author-hero" href="user.html?u=' + encodeURIComponent(author.slug) + '" style="gap:12px">',
      avatar(author),
      '<span><b style="display:block;font-size:.95rem">' + P.esc(author.name) + '</b>',
      '<small class="muted" style="font-size:.78rem">' + P.esc(author.role || T('author.label')) + '</small></span>',
      '</a>',
      author.bio ? '<p class="muted" style="font-size:.84rem;margin:12px 0 0">' + P.esc(author.bio) + '</p>' : '',
      '</div>',

      '<div class="panel"><h4>' + P.esc(T('nav.categories')) + '</h4><ul class="cat-list">' +
      P.categoriesWithCount().map(function (c) {
        return '<li><a href="category.html?cat=' + encodeURIComponent(c.slug) + '"' + (c.slug === post.category ? ' class="is-active"' : '') + '>' +
          P.icon(c.icon || 'folder', 16) + P.esc(c.name) + '<span>' + c.count + '</span></a></li>';
      }).join('') + '</ul></div>',

      '<div class="panel" id="tocPanel" hidden><h4>' + P.esc(T('post.toc')) + '</h4><nav class="toc" id="tocNav"></nav></div>',

      '<div class="panel"><h4>' + P.esc(T('post.related')) + '</h4><div style="display:flex;flex-direction:column;gap:8px">' +
      (P.relatedPosts(post, 3).map(function (r) { return P.postRow(r); }).join('') || '<span class="muted" style="font-size:.84rem">' + P.esc(T('post.noRelated')) + '</span>') +
      '</div></div>',
      '</aside>',
      '</div>'
    ].join('');

    /* SEO: gizli anahtar kelimeler + Article şeması (anahtar kelimeler sayfada GÖRÜNMEZ) */
    P.applySeoKeywords(post);
    var ogu = P.qs('meta[property="og:url"]') || (function () {
      var m = document.createElement('meta'); m.setAttribute('property', 'og:url'); document.head.appendChild(m); return m;
    })();
    ogu.setAttribute('content', P.disqusThreadUrl(post));

    /* content images → Fancybox gallery */
    P.qsa('#articleBody img').forEach(function (img) {
      img.setAttribute('loading', 'lazy');
      var a = document.createElement('a');
      a.href = img.currentSrc || img.src;
      a.setAttribute('data-fancybox', 'article');
      a.setAttribute('data-caption', img.alt || '');
      img.parentNode.insertBefore(a, img);
      a.appendChild(img);
    });
    P.initFancybox();

    /* table of contents */
    P.buildTOC(P.qs('#articleBody'), P.qs('#tocNav'));
    var tocNav = P.qs('#tocNav');
    if (tocNav && tocNav.children.length) P.qs('#tocPanel').hidden = false;

    /* share */
    var shareBtn = P.qs('#shareCopy');
    if (shareBtn) shareBtn.addEventListener('click', async function () {
      var ok = await P.copyText(location.href);
      P.toast(ok ? T('post.linkCopied') : T('post.linkFailed'), ok ? 'success' : 'error');
    });

    /* comments — her yazı için ayrı Disqus konusu */
    var commentsHost = P.qs('#disqus_thread');
    if (commentsHost && !commentsHost.getAttribute('data-mounted')) {
      P.mountDisqus(post, commentsHost, { theme: window.PP_I18N ? window.PP_I18N.current() : '' });
    }

    P.reveal();
    } /* renderPost sonu */
  });

  function avatar(u) {
    if (u.avatar) return '<span class="author-avatar"><img src="' + P.esc(u.avatar) + '" alt=""></span>';
    var initials = String(u.name || '?').trim().split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
    return '<span class="author-avatar">' + P.esc(initials) + '</span>';
  }

  function renderMissing(title, text) {
    var host = P.qs('#postRoot');
    document.title = title + ' — ' + (P.CFG.siteName || 'PrePortal');
    host.innerHTML = '<div style="padding:40px 0">' + P.emptyState(title, text,
      '<a class="btn btn--primary" href="blog.html">' + P.esc(T('post.backToArchive')) + '</a>') + '</div>';
    P.reveal();
  }
})();

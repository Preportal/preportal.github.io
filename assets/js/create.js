/* =====================================================================
   PrePortal — publishing studio (create.html)
   CKEditor 5 · autosave · image handling · publish tool
   ===================================================================== */
(function () {
  var P = window.PrePortal;
  var T = P.t;
  var LS_KEY = 'preportal:draft';
  var LS_LIST = 'preportal:drafts';

  var state = {
    editor: null,
    images: [],          // uploaded images {name, path, url}
    current: null,       // {post, category, user} generated output
    autosaveTimer: null,
    dirty: false,
    steps: null          // yayın adımları (dil değişince yeniden çizim için)
  };

  document.addEventListener('preportal:ready', function () {
    var host = P.qs('#editorRoot');
    if (!host) return;

    /* edit.html: yazı seçilene kadar editörü kurma (boş sayfa açılmasın) */
    if (!P.param('slug') && document.body.getAttribute('data-page') === 'edit') return;

    buildForm();
    initEditor();
    wireTabs();
    wireMeta();
    wireKeywords();
    wireDrafts();
    restoreDraft();
    if (P.param('slug')) loadPost(P.param('slug'));
  });

  /* ---------------------------------------------------------- edit mode */
  /** Düzenleme modu: mevcut yazıyı form + editöre yükler */
  async function loadPost(slug) {
    var post = P.Store.posts[slug];
    if (!post) { P.toast(T('post.notFoundTitle'), 'error'); return; }
    var set = function (id, v) { var el = P.qs('#' + id); if (el) el.value = v == null ? '' : v; };
    set('fTitle', post.title);
    var slugEl = P.qs('#fSlug');
    if (slugEl) { slugEl.value = post.slug; slugEl.dataset.touched = '1'; }
    set('fExcerpt', post.excerpt);
    set('fCat', post.category);
    set('fAuthor', post.author);
    set('fTags', (post.tags || []).join(', '));
    set('fKeywords', (post.keywords || []).join(', '));
    set('fCover', post.cover);
    set('fVersion', post.version);
    set('fSize', post.size);
    set('fPlatform', post.platform);
    set('fDownloads', (post.downloads || []).map(function (d) {
      if (typeof d === 'string') return d;
      return [d.label, d.url, d.version, d.size].filter(Boolean).join(' | ');
    }).join('\n'));
    if (post.date) {
      var dt = new Date(post.date);
      dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
      var de = P.qs('#fDate');
      if (de) de.value = dt.toISOString().slice(0, 16);
    }
    var feat = P.qs('#fFeatured');
    if (feat) feat.checked = !!post.featured;
    updateKeywordCount();
    try { updateSlugLabel(); } catch (e) { }

    /* editör hazır olunca içeriği bas */
    var wait = setInterval(function () {
      if (state.editor && state.editor.setData) {
        clearInterval(wait);
        state.editor.setData(post.content || '');
        state.dirty = false;
      }
    }, 120);
    setTimeout(function () { clearInterval(wait); }, 12000);

    state.editSlug = post.slug;
    document.body.setAttribute('data-mode', 'edit');
    var badge = P.qs('#modeBadge');
    if (badge) badge.innerHTML = P.icon('pen', 14) + '<span>' + P.esc(T('studio.modeEdit') + ' · ' + post.slug) + '</span>';
    P.toast(T('studio.editLoaded'), 'success');
  }

  function dirs() {
    return {
      posts: P.CFG.postsDir || 'p',
      category: P.CFG.categoryDir || 'category',
      users: P.CFG.usersDir || 'users',
      media: P.CFG.mediaDir || 'assets/img'
    };
  }

  /* ---------------------------------------------------------- form */
  function buildForm() {
    var catOptions = P.categoriesWithCount().map(function (c) {
      return '<option value="' + P.esc(c.slug) + '">' + P.esc(c.name) + '</option>';
    }).join('');

    var userOptions = Object.keys(P.Store.users).map(function (k) {
      return '<option value="' + P.esc(k) + '">' + P.esc(P.Store.users[k].name) + '</option>';
    }).join('');

    var preCat = P.param('cat') || '';
    var d = dirs();

    P.qs('#editorRoot').innerHTML = [
      '<div class="tabs-bar">',
      '<div class="tabs" role="tablist" aria-label="' + P.esc(T('studio.tabs')) + '">',
      '<button class="tab is-active" type="button" role="tab" aria-selected="true" data-tab="write" id="tabWrite">', P.icon('pen', 16), '<span data-i18n="studio.tabWrite"></span></button>',
      '<button class="tab" type="button" role="tab" aria-selected="false" data-tab="preview" id="tabPreview">', P.icon('eye', 16), '<span data-i18n="studio.tabPreview"></span></button>',
      '<button class="tab" type="button" role="tab" aria-selected="false" data-tab="publish" id="tabPublish">', P.icon('code', 16), '<span data-i18n="studio.tabPublish"></span></button>',
      '</div>',
      '<div class="editor-status"><span class="dot" id="saveDot"></span><span id="saveState" data-i18n="studio.ready"></span></div>',
      '</div>',

      '<div class="studio-grid">',
      '<div>',

      /* --- WRITE --- */
      '<section id="paneWrite" role="tabpanel" aria-labelledby="tabWrite">',
      '<div class="editor-shell">',
      '<div class="editor-toolbar-top">',
      '<span class="file-pill" id="modeBadge" title="">' + P.icon('pen', 14) + '<span data-i18n="studio.modeCreate"></span></span>',
      '<span class="file-pill">' + P.icon('code', 15) + '<span id="slugPreview">' + P.esc(d.posts) + '/new-post.js</span></span>',
      '<div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">',
      '<button class="btn btn--ghost btn--sm" type="button" id="btnSave">', P.icon('save', 15), '<span data-i18n="studio.save"></span></button>',
      '<button class="btn btn--ghost btn--sm" type="button" id="btnFullscreen">', P.icon('sparkle', 15), '<span data-i18n="studio.focusMode"></span></button>',
      '</div>',
      '</div>',
      '<div id="editorMount"></div>',
      '</div>',
      '</section>',

      /* --- PREVIEW --- */
      '<section id="panePreview" role="tabpanel" aria-labelledby="tabPreview" hidden>',
      '<div class="preview-frame"><div class="prose" id="previewBody"></div></div>',
      '</section>',

      /* --- PUBLISH --- */
      '<section id="panePublish" role="tabpanel" aria-labelledby="tabPublish" hidden>',
      '<div class="panel">',
      '<h4 data-i18n="studio.generatedFile"></h4>',
      '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:14px">',
      '<span class="file-pill">' + P.icon('code', 15) + '<span id="outFileName">' + P.esc(d.posts) + '/new-post.js</span></span>',
      '<button class="btn btn--primary btn--sm" type="button" id="btnCopyCode">', P.icon('copy', 15), '<span data-i18n="studio.copyCode"></span></button>',
      '<button class="btn btn--soft btn--sm" type="button" id="btnDownloadCode">', P.icon('download', 15), '<span data-i18n="studio.downloadFile"></span></button>',
      '</div>',
      '<pre class="code-output" id="codeOut" tabindex="0"></pre>',
      '<div id="extraFiles" style="display:flex;flex-direction:column;gap:10px;margin-top:12px"></div>',
      '</div>',

      '<div class="panel" style="margin-top:16px">',
      '<h4 data-i18n="studio.publishSteps"></h4>',
      '<div class="publish-steps" id="publishSteps"></div>',
      '</div>',

      '<div class="panel" style="margin-top:16px">',
      '<h4 data-i18n="studio.images"></h4>',
      '<div id="imageList" class="draft-list"><span class="muted" style="font-size:.84rem" data-i18n="studio.noImages"></span></div>',
      '</div>',
      '</section>',

      '</div>',

      /* --- SIDEBAR: META --- */
      '<aside class="sidebar">',
      '<div class="panel">',
      '<h4 data-i18n="studio.postInfo"></h4>',
      '<div class="form-grid" style="grid-template-columns:1fr">',

      '<div class="form-row">',
      '<label class="label" for="fTitle"><span data-i18n="studio.fTitle"></span> <span class="required">*</span></label>',
      '<input class="input" id="fTitle" type="text" maxlength="140" autocomplete="off" data-i18n-attr="placeholder:studio.titlePlaceholder">',
      '</div>',

      '<div class="form-row">',
      '<label class="label" for="fSlug" data-i18n="studio.fSlug"></label>',
      '<input class="input" id="fSlug" type="text" autocomplete="off" spellcheck="false" data-i18n-attr="placeholder:studio.slugPlaceholder">',
      '<span class="hint" data-i18n-html="studio.fSlugHint"></span>',
      '</div>',

      '<div class="form-row">',
      '<label class="label" for="fExcerpt" data-i18n="studio.fExcerpt"></label>',
      '<textarea class="textarea" id="fExcerpt" rows="3" maxlength="260" data-i18n-attr="placeholder:studio.fExcerptPh"></textarea>',
      '</div>',

      '<div class="form-row">',
      '<label class="label" for="fCat" data-i18n="studio.fCategory"></label>',
      '<div class="select-wrap"><select class="select" id="fCat">' + (catOptions || '<option value="general">general</option>') + '</select></div>',
      '</div>',

      '<div class="form-row">',
      '<label class="label" for="fAuthor" data-i18n="studio.fAuthor"></label>',
      '<div class="select-wrap"><select class="select" id="fAuthor">' + (userOptions || '<option value="preportal">PrePortal</option>') + '</select></div>',
      '</div>',

      '<div class="form-row">',
      '<label class="label" for="fTags" data-i18n="studio.fTags"></label>',
      '<input class="input" id="fTags" type="text" autocomplete="off" data-i18n-attr="placeholder:studio.tagsPlaceholder">',
      '<span class="hint" data-i18n="studio.fTagsHint"></span>',
      '</div>',

      '<div class="form-row">',
      '<label class="label" for="fKeywords" data-i18n="studio.fKeywords"></label>',
      '<textarea class="textarea js-autogrow" id="fKeywords" rows="3" spellcheck="false" data-i18n-attr="placeholder:studio.keywordsPlaceholder"></textarea>',
      '<span class="hint" data-i18n="studio.fKeywordsHint"></span>',
      '<span class="hint hint--count" id="kwCount"></span>',
      '</div>',

      '<div class="form-row">',
      '<label class="label" for="fDate" data-i18n="studio.fDate"></label>',
      '<input class="input" id="fDate" type="datetime-local">',
      '</div>',

      '<div class="form-row">',
      '<label class="label" for="fCover" data-i18n="studio.fCover"></label>',
      '<input class="input" id="fCover" type="text" autocomplete="off" data-i18n-attr="placeholder:studio.coverPlaceholder">',
      '<button class="btn btn--ghost btn--sm" type="button" id="btnPickCover">', P.icon('upload', 15), '<span data-i18n="studio.fPickCover"></span></button>',
      '<input type="file" id="coverFile" accept="image/*" hidden>',
      '</div>',

      '<label class="label" style="gap:8px;cursor:pointer"><input type="checkbox" id="fFeatured"> <span data-i18n="studio.fFeatured"></span></label>',
      '</div>',
      '</div>',

      '<div class="panel">',
      '<h4><span data-i18n="studio.appInfo"></span> <span class="pill" data-i18n="studio.optional"></span></h4>',
      '<div class="form-grid" style="grid-template-columns:1fr">',
      '<div class="form-row"><label class="label" for="fVersion" data-i18n="studio.fVersion"></label><input class="input" id="fVersion" data-i18n-attr="placeholder:studio.versionPlaceholder"></div>',
      '<div class="form-row"><label class="label" for="fSize" data-i18n="studio.fSize"></label><input class="input" id="fSize" data-i18n-attr="placeholder:studio.sizePlaceholder"></div>',
      '<div class="form-row"><label class="label" for="fPlatform" data-i18n="studio.fPlatform"></label><input class="input" id="fPlatform" data-i18n-attr="placeholder:studio.platformPlaceholder"></div>',
      '<div class="form-row"><label class="label" for="fDownloads" data-i18n="studio.fDownloads"></label>',
      '<textarea class="textarea" id="fDownloads" rows="3" data-i18n-attr="placeholder:studio.downloadsPlaceholder"></textarea>',
      '<span class="hint" data-i18n-html="studio.fDownloadsHint"></span></div>',
      '</div>',
      '</div>',

      '<div class="panel">',
      '<h4 data-i18n="studio.drafts"></h4>',
      '<div class="draft-list" id="draftList"></div>',
      '<button class="btn btn--danger btn--sm" type="button" id="btnClearDraft" style="margin-top:12px;width:100%">', P.icon('trash', 15), '<span data-i18n="studio.clearDraft"></span></button>',
      '</div>',
      '</aside>',
      '</div>'
    ].join('');

    if (preCat) {
      var sel = P.qs('#fCat');
      if (sel) sel.value = preCat;
    }
    var now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    P.qs('#fDate').value = now.toISOString().slice(0, 16);

    /* translate the freshly injected markup */
    if (window.PP_I18N) window.PP_I18N.apply(P.qs('#editorRoot'));
  }

  /* ---------------------------------------------------------- CKEditor */
  /** Picks the plugins that really exist in the loaded CKEditor build */
  function resolvedPlugins() {
    var C = window.CKEDITOR || {};
    var list = ['Essentials', 'Paragraph', 'Heading', 'Bold', 'Italic', 'Underline', 'Strikethrough',
      'Subscript', 'Superscript', 'Code', 'CodeBlock', 'Link', 'AutoLink', 'List', 'TodoList',
      'Alignment', 'BlockQuote', 'Indent', 'HorizontalLine', 'Table', 'TableToolbar', 'Image',
      'ImageToolbar', 'ImageCaption', 'ImageStyle', 'ImageInsert', 'ImageUpload', 'ImageResize',
      'MediaEmbed', 'HtmlEmbed', 'Autoformat', 'Font', 'FontColor', 'FontBackgroundColor',
      'FontSize', 'Highlight', 'RemoveFormat', 'SpecialCharacters', 'FindAndReplace',
      'SourceEditing', 'PasteFromOffice', 'ShowBlocks', 'WordCount', 'GeneralHtmlSupport',
      'Style', 'Fullscreen'];
    var plugins = [];
    list.forEach(function (name) { if (C[name]) plugins.push(C[name]); });
    if (!plugins.length) throw new Error('CKEditor plugins not found');
    return plugins;
  }

  function editorLang() {
    var code = (window.PP_I18N && window.PP_I18N.current()) || 'en';
    return code;
  }

  function editorTranslation() {
    var tr = window.CKEDITOR_TRANSLATIONS || {};
    var code = editorLang();
    return tr[code] ? tr[code] : undefined;
  }

  function initEditor() {
    var mount = P.qs('#editorMount');
    createEditor(mount, { placeholder: T('studio.editorPlaceholder') }).then(function (ed) {
      state.editor = ed;
      if (!ed.fallback) {
        /* ed.model is the edit root; the data watcher is in the ckeditor factory */
      }
    });
  }

  /**
   * CKEditor 5 kurucusu (create.html ve edit.html aynı ayarları kullanır).
   * Dönüş: { getData, setData, focus, fallback }
   */
  function createEditor(mount, opts) {
    opts = opts || {};
    var ph = opts.placeholder || T('studio.editorPlaceholder');
    if (!mount) return Promise.resolve(null);

    function fallbackEditor(err) {
      mount.innerHTML = '<textarea id="fallbackEditor" style="min-height:420px;width:100%;padding:16px;background:var(--surface);border:0;color:var(--text)"></textarea>';
      var ta = P.qs('#fallbackEditor');
      ta.setAttribute('placeholder', ph);
      ta.addEventListener('input', scheduleAutosave);
      if (err) console.error(err);
      P.toast(err ? T('studio.editorFailed', { msg: (err && err.message) ? err.message : 'unknown error' }) : T('studio.editorFallback'), err ? 'error' : 'warn');
      return { getData: function () { return ta.value; }, setData: function (v) { ta.value = v || ''; }, fallback: true, focus: function () { ta.focus(); } };
    }

    if (!window.CKEDITOR || !window.CKEDITOR.ClassicEditor) return Promise.resolve(fallbackEditor(null));

    var uploadAdapter = createUploadAdapter();
    return window.CKEDITOR.ClassicEditor.create(mount, {
      licenseKey: 'GPL',
      translations: [editorTranslation()].filter(Boolean),
      language: editorLang(),
      initialData: opts.data || '',
      placeholder: ph,
      plugins: resolvedPlugins(),
      toolbar: {
        items: [
          'undo', 'redo', '|',
          'heading', 'style', '|',
          'bold', 'italic', 'underline', 'strikethrough', 'code', '|',
          'fontSize', 'fontColor', 'fontBackgroundColor', 'highlight', '|',
          'bulletedList', 'numberedList', 'todoList', '|',
          'outdent', 'indent', 'alignment', '|',
          'link', 'insertImage', 'mediaEmbed', 'insertTable', 'blockQuote', 'codeBlock', 'horizontalLine', 'specialCharacters', '|',
          'removeFormat', 'sourceEditing', 'fullscreen'
        ],
        shouldNotGroupWhenFull: true
      },
      heading: {
        options: [
          { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
          { model: 'heading2', view: 'h2', title: 'H2', class: 'ck-heading_heading2' },
          { model: 'heading3', view: 'h3', title: 'H3', class: 'ck-heading_heading3' },
          { model: 'heading4', view: 'h4', title: 'H4', class: 'ck-heading_heading4' }
        ]
      },
      image: {
        resizeUnit: '%',
        resizeOptions: [
          { name: 'resizeImage:original', value: null, label: '100%' },
          { name: 'resizeImage:25', value: '25', label: '25%' },
          { name: 'resizeImage:50', value: '50', label: '50%' },
          { name: 'resizeImage:75', value: '75', label: '75%' }
        ],
        toolbar: ['imageStyle:inline', 'imageStyle:block', 'imageStyle:side', '|', 'toggleImageCaption', 'imageTextAlternative', '|', 'resizeImage', '|', 'linkImage']
      },
      table: { contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells', 'tableProperties', 'tableCellProperties'] },
      link: { addTargetToExternalLinks: true, defaultProtocol: 'https://' },
      htmlSupport: { allow: [{ name: /.*/, attributes: true, classes: true, styles: true }] },
      wordCount: { onUpdate: function (stats) { updateCounters(stats); } },
      extraPlugins: [uploadAdapter.plugin]
    }).then(function (editor) {
      editor.model.document.on('change:data', function () { state.dirty = true; scheduleAutosave(); });
      P.toast(T('studio.editorReady'), 'success');
      return {
        getData: function () { return editor.getData(); },
        setData: function (v) { editor.setData(v || ''); },
        focus: function () { editor.editing.view.focus(); },
        instance: editor,
        fallback: false
      };
    }).catch(function (err) { return fallbackEditor(err); });
  }

  window.PrePortal.editorFactory = createEditor;

  function updateCounters(stats) {
    var el = P.qs('#slugPreview');
    if (!el) return;
    el.setAttribute('title', T('studio.wordsTooltip', { words: stats.words, chars: stats.characters }));
  }

  /* ---------------------------------------------------------- image upload */
  function createUploadAdapter() {
    function UploadAdapter(loader) { this.loader = loader; }

    UploadAdapter.prototype.upload = function () {
      var self = this;
      return this.loader.file.then(function (file) { return handleFile(file, self.loader); });
    };
    UploadAdapter.prototype.abort = function () { };

    return {
      plugin: function (editor) {
        editor.plugins.get('FileRepository').createUploadAdapter = function (loader) {
          return new UploadAdapter(loader);
        };
      }
    };
  }

  /** Prepares an image according to the configured mode: ImgBB, GitHub API or a repo file */
  async function handleFile(file, loader) {
    if (!file || !/^image\//.test(file.type)) throw new Error(T('studio.imageOnly'));
    if (file.size > 8 * 1024 * 1024) throw new Error(T('studio.imageTooBig'));

    var cfg = P.CFG.media || { mode: 'repo' };
    var d = dirs();

    if (cfg.mode === 'imgbb' && cfg.imgbbKey) {
      var fd = new FormData();
      fd.append('image', file);
      var res = await fetch('https://api.imgbb.com/1/upload?key=' + encodeURIComponent(cfg.imgbbKey), { method: 'POST', body: fd });
      var json = await res.json();
      if (!json.success) throw new Error(T('studio.imgbbFailed'));
      var url = json.data.display_url || json.data.url;
      pushImage(file.name, url);
      return { default: url };
    }

    if (cfg.mode === 'github' && cfg.githubToken && cfg.githubOwner && cfg.githubRepo) {
      var b64 = await fileToBase64(file);
      var path = d.media + '/' + Date.now() + '-' + safeName(file.name);
      var api = 'https://api.github.com/repos/' + cfg.githubOwner + '/' + cfg.githubRepo + '/contents/' + encodeURIComponent(path).replace(/%2F/g, '/');
      var r = await fetch(api, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + cfg.githubToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'chore(media): ' + file.name, content: b64.replace(/^data:[^,]+,/, ''), branch: cfg.githubBranch || 'main' })
      });
      if (!r.ok) throw new Error(T('studio.githubFailed', { status: r.status }));
      var j = await r.json();
      var raw = j.content && j.content.download_url ? j.content.download_url : path;
      pushImage(file.name, raw);
      return { default: raw };
    }

    /* repo mode: the user adds the file to the repo manually; the path is generated */
    var localPath = d.media + '/' + safeName(file.name);
    var dataUrl = await readAsDataURL(file);
    pushImage(file.name, localPath, dataUrl);
    P.toast(T('studio.imagePrepared', { path: localPath }), 'warn');
    return { default: dataUrl };
  }

  function pushImage(name, path, dataUrl) {
    state.images.push({ name: name, path: path, dataUrl: dataUrl || '' });
    renderImageList();
  }

  function renderImageList() {
    var host = P.qs('#imageList');
    if (!host) return;
    if (!state.images.length) {
      host.innerHTML = '<span class="muted" style="font-size:.84rem">' + P.esc(T('studio.noImages')) + '</span>';
      return;
    }
    host.innerHTML = state.images.map(function (img, i) {
      return '<div class="draft-item">' + P.icon('link', 15) +
        '<span><b>' + P.esc(img.name) + '</b><br><small>' + P.esc(img.path) + '</small></span>' +
        '<button class="icon-btn" type="button" data-copy-img="' + i + '" aria-label="' + P.esc(T('studio.copyPath')) + '" title="' + P.esc(T('studio.copyPath')) + '">' + P.icon('copy', 15) + '</button>' +
        (img.dataUrl ? '<button class="icon-btn" type="button" data-dl-img="' + i + '" aria-label="' + P.esc(T('actions.download')) + '" title="' + P.esc(T('actions.download')) + '">' + P.icon('download', 15) + '</button>' : '') +
        '</div>';
    }).join('');
    P.qsa('[data-dl-img]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var img = state.images[Number(b.getAttribute('data-dl-img'))];
        var a = document.createElement('a');
        a.href = img.dataUrl;
        a.download = img.path.split('/').pop();
        a.click();
        P.toast(T('media.downloaded', { name: a.download }), 'success');
      });
    });
    P.qsa('[data-copy-img]', host).forEach(function (b) {
      b.addEventListener('click', async function () {
        var img = state.images[Number(b.getAttribute('data-copy-img'))];
        var ok = await P.copyText(img.path);
        P.toast(ok ? T('studio.pathCopied', { path: img.path }) : T('studio.copyFailed'), ok ? 'success' : 'error');
      });
    });
  }

  function readAsDataURL(file) {
    return new Promise(function (res) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.readAsDataURL(file);
    });
  }
  function fileToBase64(file) { return readAsDataURL(file); }
  function safeName(name) {
    return P.slugify(name.replace(/\.[^.]+$/, '')) + (name.match(/\.[^.]+$/) ? name.match(/\.[^.]+$/)[0].toLowerCase() : '');
  }

  /* ---------------------------------------------------------- meta fields */
  function wireMeta() {
    var title = P.qs('#fTitle');
    var slug = P.qs('#fSlug');

    title.addEventListener('input', function () {
      if (!slug.dataset.touched) slug.value = P.slugify(title.value);
      updateSlugLabel();
      scheduleAutosave();
    });
    slug.addEventListener('input', function () {
      slug.dataset.touched = '1';
      slug.value = P.slugify(slug.value);
      updateSlugLabel();
      scheduleAutosave();
    });
    ['#fExcerpt', '#fCat', '#fAuthor', '#fTags', '#fKeywords', '#fDate', '#fCover', '#fVersion', '#fSize', '#fPlatform', '#fDownloads'].forEach(function (sel) {
      var el = P.qs(sel);
      if (el) el.addEventListener('input', scheduleAutosave);
      if (el) el.addEventListener('change', scheduleAutosave);
    });
    P.qs('#fFeatured').addEventListener('change', scheduleAutosave);

    P.qs('#btnSave').addEventListener('click', function () { saveDraft(true); });
    P.qs('#btnFullscreen').addEventListener('click', function () {
      var shell = P.qs('.editor-shell');
      shell.classList.toggle('is-focus');
      shell.style.position = shell.classList.contains('is-focus') ? 'fixed' : '';
      shell.style.inset = shell.classList.contains('is-focus') ? '0' : '';
      shell.style.zIndex = shell.classList.contains('is-focus') ? '150' : '';
      shell.style.borderRadius = shell.classList.contains('is-focus') ? '0' : '';
      shell.style.background = 'var(--surface)';
    });

    P.qs('#btnPickCover').addEventListener('click', function () { P.qs('#coverFile').click(); });
    P.qs('#coverFile').addEventListener('change', async function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        var out = await handleFile(f, null);
        P.qs('#fCover').value = out.default && out.default.indexOf('data:') === 0 ? (state.images[state.images.length - 1].path) : out.default;
        P.toast(T('studio.coverAdded'), 'success');
      } catch (err) {
        P.toast(err.message || T('studio.uploadFailed'), 'error');
      }
    });
  }

  function updateSlugLabel() {
    var d = dirs();
    var s = P.qs('#fSlug').value || 'new-post';
    var fileName = d.posts + '/' + s + '.js';
    var label = P.qs('#slugPreview');
    if (label) label.textContent = fileName;
    var out = P.qs('#outFileName');
    if (out) out.textContent = fileName;
  }

  /* ---------------------------------------------------------- tabs */
  function wireTabs() {
    P.qsa('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-tab');
        P.qsa('[data-tab]').forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        P.qs('#paneWrite').hidden = tab !== 'write';
        P.qs('#panePreview').hidden = tab !== 'preview';
        P.qs('#panePublish').hidden = tab !== 'publish';
        if (tab === 'preview') renderPreview();
        if (tab === 'publish') buildOutput();
      });
    });

    var tab = P.param('tab');
    if (tab === 'publish') P.qs('#tabPublish').click();
    if (tab === 'preview') P.qs('#tabPreview').click();
  }

  /* ---------------------------------------------------------- data collection */
  function collect() {
    var get = function (id) { var el = P.qs('#' + id); return el ? el.value.trim() : ''; };
    var slug = P.slugify(get('fSlug') || get('fTitle'));
    var content = state.editor ? state.editor.getData() : '';
    var downloads = get('fDownloads').split('\n').map(function (line) {
      line = line.trim();
      if (!line) return null;
      var parts = line.split('|');
      var url = (parts[1] || parts[0]).trim();
      return { label: (parts[1] ? parts[0] : T('studio.downloadLabel')).trim(), url: url };
    }).filter(Boolean);

    var dateVal = get('fDate');
    var date = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString();

    return {
      slug: slug,
      title: get('fTitle') || T('studio.untitled'),
      excerpt: get('fExcerpt'),
      content: content,
      category: get('fCat') || 'general',
      author: get('fAuthor') || 'preportal',
      tags: get('fTags').split(',').map(function (t) { return t.trim(); }).filter(Boolean),
      keywords: parseKeywords(P.qs('#fKeywords').value),
      date: date,
      updated: new Date().toISOString(),
      cover: get('fCover'),
      featured: P.qs('#fFeatured').checked,
      version: get('fVersion'),
      size: get('fSize'),
      platform: get('fPlatform'),
      downloads: downloads,
      status: 'published'
    };
  }

  function validate(post) {
    var errs = [];
    if (!P.qs('#fTitle').value.trim()) errs.push(T('studio.errTitle'));
    if (!post.content || P.stripTags(post.content).length < 20) errs.push(T('studio.errContent'));
    return errs;
  }

  /* ---------------------------------------------------------- preview */
  function renderPreview() {
    var post = collect();
    P.qs('#previewBody').innerHTML = [
      '<span class="badge badge--accent">' + P.esc(P.getCategory(post.category).name) + '</span>',
      '<h1 style="margin:12px 0 10px">' + P.esc(post.title) + '</h1>',
      post.excerpt ? '<p class="article-lead">' + P.esc(post.excerpt) + '</p>' : '',
      '<div class="article-meta" style="margin:16px 0 26px">',
      '<span class="meta-item">' + P.icon('user', 14) + P.esc(P.getUser(post.author).name) + '</span>',
      '<span class="meta-item">' + P.icon('clock', 14) + P.esc(P.formatDate(post.date)) + '</span>',
      '<span class="meta-item">' + P.icon('book', 14) + P.esc(T('post.readingTime', { n: P.readingTime(post.content) })) + '</span>',
      '</div>',
      post.cover ? '<img src="' + P.esc(post.cover) + '" alt="">' : '',
      post.content || '<p class="muted">' + P.esc(T('studio.previewEmpty')) + '</p>'
    ].join('');
  }

  /* ---------------------------------------------------------- publish output */
  function buildOutput() {
    var post = collect();
    var d = dirs();
    var code = P.publish.buildPostFile(post);
    var out = P.qs('#codeOut');
    out.innerHTML = P.publish.highlight(code);
    state.current = post;

    var postIds = P.publish.withId(window.PREPORTAL_POSTS || [], post.slug);
    var catExists = !!P.Store.categories[post.category];
    var userExists = !!P.Store.users[post.author];

    var steps = [];
    steps.push(step(1, T('studio.stepAddFile'),
      T('studio.stepAddFileText', { path: d.posts + '/' + post.slug + '.js' })));
    steps.push(step(2, T('studio.stepList'), T('studio.stepListText', { path: d.posts + '/index.js' })));
    if (!catExists) steps.push(step(steps.length + 1, T('studio.stepCategory'),
      T('studio.stepCategoryText', { path: d.category + '/' + post.category + '.js' })));
    if (!userExists) steps.push(step(steps.length + 1, T('studio.stepAuthor'),
      T('studio.stepAuthorText', { path: d.users + '/' + post.author + '.js' })));
    steps.push(step(steps.length + 1, T('studio.stepCommit'), T('studio.stepCommitText')));

    state.steps = steps;
    renderSteps();

    /* extra file suggestions */
    var extra = [];
    if (!catExists) extra.push({ name: d.category + '/' + post.category + '.js', code: P.publish.buildCategoryFile({ slug: post.category, name: ucfirst(post.category), description: '', icon: 'folder' }) });
    if (!userExists) extra.push({ name: d.users + '/' + post.author + '.js', code: P.publish.buildUserFile({ slug: post.author, name: ucfirst(post.author) }) });
    /* Dizin dosyaları artık elle güncellenmez: derleyici üretir.
     * İsteğe bağlı olarak yine de indirilebilsin diye listede duruyor. */
    /* Dizin dosyalarına gerek yok: motor yazıyı kendi bulur.
     * İsteğe bağlı olarak p/index.js listesi de üretilir (sıralı liste). */
    extra.push({
      name: d.posts + '/index.js',
      code: 'window.PREPORTAL_POSTS = ' + JSON.stringify(postIds, null, 2) + ';\n'
    });
    state.extra = extra;

    renderExtraFiles();

    var btnCopy = P.qs('#btnCopyCode');
    btnCopy.onclick = async function () {
      var ok = await P.copyText(code);
      P.toast(ok ? T('studio.codeCopied') : T('studio.copyFailed'), ok ? 'success' : 'error');
    };
    P.qs('#btnDownloadCode').onclick = function () {
      var errs = validate(post);
      if (errs.length) { P.toast(errs[0], 'warn'); }
      P.download(post.slug + '.js', code);
      P.toast(T('studio.fileDownloaded', { name: post.slug + '.js' }), 'success');
    };
  }

  /** Category/author/index files: download + copy */
  function renderExtraFiles() {
    var host = P.qs('#extraFiles');
    if (!host) return;
    var extra = state.extra || [];
    if (!extra.length) { host.innerHTML = ''; return; }
    host.innerHTML = extra.map(function (f, i) {
      return '<div class="draft-item" style="flex-wrap:wrap;gap:8px">' +
        P.icon('code', 15) +
        '<span style="min-width:0;flex:1"><b>' + P.esc(f.name) + '</b><br><small>' + P.esc(T('studio.lines', { n: f.code.split('\n').length })) + '</small></span>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-extra-copy="' + i + '">' + P.icon('copy', 14) + P.esc(T('studio.copyShort')) + '</button>' +
        '<button class="btn btn--soft btn--sm" type="button" data-extra-dl="' + i + '">' + P.icon('download', 14) + P.esc(T('studio.downloadShort')) + '</button>' +
        '</div>';
    }).join('');

    P.qsa('[data-extra-copy]', host).forEach(function (b) {
      b.addEventListener('click', async function () {
        var f = extra[Number(b.getAttribute('data-extra-copy'))];
        var ok = await P.copyText(f.code);
        P.toast(ok ? T('studio.extraCopied', { name: f.name }) : T('studio.copyFailed'), ok ? 'success' : 'error');
      });
    });
    P.qsa('[data-extra-dl]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var f = extra[Number(b.getAttribute('data-extra-dl'))];
        P.download(f.name.split('/').pop(), f.code);
        P.toast(T('admin.downloaded', { file: f.name }), 'success');
      });
    });
  }

  function step(n, title, html) {
    return '<div class="publish-step"><span class="publish-step__n">' + n + '</span><div><b>' + P.esc(title) + '</b><p>' + html + '</p></div></div>';
  }
  function ucfirst(s) { return String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1); }

  /* ---------------------------------------------------------- autosave */
  function scheduleAutosave() {
    var dot = P.qs('#saveDot');
    if (dot) dot.classList.add('is-saving');
    var st = P.qs('#saveState');
    if (st) st.textContent = T('studio.saving');
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = setTimeout(function () { saveDraft(false); }, 900);
    updateSlugLabel();
  }

  function saveDraft(manual) {
    var post = collect();
    var payload = { post: post, images: state.images, savedAt: new Date().toISOString() };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
      var list = JSON.parse(localStorage.getItem(LS_LIST) || '[]');
      list = list.filter(function (x) { return x.slug !== post.slug; });
      list.unshift({ slug: post.slug, title: post.title, savedAt: payload.savedAt });
      localStorage.setItem(LS_LIST, JSON.stringify(list.slice(0, 8)));
    } catch (e) {
      if (manual) P.toast(T('studio.draftFailed'), 'error');
      return;
    }
    var dot = P.qs('#saveDot');
    if (dot) dot.classList.remove('is-saving');
    var st = P.qs('#saveState');
    if (st) st.textContent = T('studio.saved') + ' · ' + P.formatTime(new Date());
    if (manual) P.toast(T('studio.draftSaved'), 'success');
    renderDrafts();
    state.dirty = false;
  }

  function restoreDraft() {
    var raw;
    try { raw = localStorage.getItem(LS_KEY); } catch (e) { raw = null; }
    if (!raw) return;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return; }
    if (!data || !data.post) return;
    var p = data.post;
    var set = function (id, v) { var el = P.qs('#' + id); if (el) el.value = v || ''; };
    set('fTitle', p.title === T('studio.untitled') ? '' : p.title);
    set('fSlug', p.slug);
    P.qs('#fSlug').dataset.touched = '1';
    set('fExcerpt', p.excerpt);
    set('fTags', (p.tags || []).join(', '));
    set('fKeywords', (p.keywords || []).join(', '));
    updateKeywordCount();
    set('fCover', p.cover);
    set('fVersion', p.version);
    set('fSize', p.size);
    set('fPlatform', p.platform);
    set('fDownloads', (p.downloads || []).map(function (dl) { return (dl.label || T('studio.downloadLabel')) + ' | ' + dl.url; }).join('\n'));
    if (p.category && P.qs('#fCat')) P.qs('#fCat').value = p.category;
    if (p.author && P.qs('#fAuthor')) P.qs('#fAuthor').value = p.author;
    if (p.date) {
      var dt = new Date(p.date);
      dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
      P.qs('#fDate').value = dt.toISOString().slice(0, 16);
    }
    P.qs('#fFeatured').checked = !!p.featured;
    state.images = data.images || [];
    renderImageList();
    if (state.editor) state.editor.setData(p.content || '');
    else {
      /* editor may still be loading */
      var iv = setInterval(function () {
        if (state.editor) { state.editor.setData(p.content || ''); clearInterval(iv); }
      }, 200);
    }
    updateSlugLabel();
    P.toast(T('studio.draftRestored'), 'info');
  }

  function renderDrafts() {
    var host = P.qs('#draftList');
    if (!host) return;
    var list;
    try { list = JSON.parse(localStorage.getItem(LS_LIST) || '[]'); } catch (e) { list = []; }
    host.innerHTML = list.length ? list.map(function (dr) {
      return '<div class="draft-item"><span><b>' + P.esc(P.truncate(dr.title, 26)) + '</b><br><small>' + P.esc(P.formatDateTime(new Date(dr.savedAt))) + '</small></span></div>';
    }).join('') : '<span class="muted" style="font-size:.84rem">' + P.esc(T('studio.noDrafts')) + '</span>';
  }

  function wireDrafts() {
    renderDrafts();
    P.qs('#btnClearDraft').addEventListener('click', function () {
      try {
        localStorage.removeItem(LS_KEY);
        localStorage.removeItem(LS_LIST);
      } catch (e) { }
      P.toast(T('studio.draftCleared'), 'info');
      setTimeout(function () { location.reload(); }, 700);
    });
    window.addEventListener('beforeunload', function () {
      if (state.dirty) { saveDraft(false); }
    });
  }
  /* ---------------------------------------------------------- keywords */
  /* Virgül veya satırla ayrılır; sınır YOK, gizli alan (SEO) */
  function parseKeywords(raw) {
    var seen = {}, out = [];
    String(raw || '').split(/\r?\n|,/).forEach(function (k) {
      k = k.replace(/\s+/g, ' ').trim();
      if (!k || k.length > 120) return;
      var key = P.fold(k);
      if (!key || seen[key]) return;
      seen[key] = 1;
      out.push(k);
    });
    return out;
  }

  function updateKeywordCount() {
    var el = P.qs('#kwCount');
    var box = P.qs('#fKeywords');
    if (!el || !box) return;
    el.textContent = T('studio.kwCount', { n: parseKeywords(box.value).length });
  }

  function wireKeywords() {
    var box = P.qs('#fKeywords');
    if (!box) return;
    box.addEventListener('input', function () {
      box.style.height = 'auto';
      box.style.height = Math.min(360, box.scrollHeight + 2) + 'px';
      updateKeywordCount();
    });
    updateKeywordCount();
  }

  /* ---------------------------------------------------------- dil değişimi */
  /** Yayın adımlarını yeniden çizer */
  function renderSteps() {
    if (!state.steps) return;
    var host = P.qs('#publishSteps');
    if (host) host.innerHTML = state.steps.join('');
  }

  /* Dil değişince stüdyo arayüzü anında yenilenir (sayfa yenilemek yok) */
  document.addEventListener('preportal:lang', function () {
    /* kaydetme durumu: "Hazır" */
    var st = P.qs('#saveState');
    if (st) st.textContent = T('studio.ready');
    var dot = P.qs('#saveDot');
    if (dot) dot.classList.remove('is-saving');

    /* mod rozeti (düzenleme modunda slug metni) */
    var badge = P.qs('#modeBadge');
    if (badge && document.body.getAttribute('data-mode') === 'edit' && state.editSlug) {
      badge.innerHTML = P.icon('pen', 14) + '<span>' + P.esc(T('studio.modeEdit') + ' · ' + state.editSlug) + '</span>';
    }

    /* yayın adımları + ekstra dosyalar (yayın sekmesi görünürse) */
    var publishPane = P.qs('#panePublish');
    if (publishPane && !publishPane.hidden) {
      renderSteps();
      renderExtraFiles();
    }

    /* önizleme sekmesi görünürse önizlemeyi güncelle */
    var previewPane = P.qs('#panePreview');
    if (previewPane && !previewPane.hidden) renderPreview();
  });
})();

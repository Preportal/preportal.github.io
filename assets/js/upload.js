/* =====================================================================
   PrePortal — image preparation (upload.html)
   Resize + WebP compression in the browser. Nothing is uploaded to a server.
   ===================================================================== */
(function () {
  var P = window.PrePortal;
  var T = P.t;

  document.addEventListener('preportal:ready', function () {
    var input = P.qs('#fileInput');
    var drop = P.qs('#dropZone');
    var results = P.qs('#uploadResults');
    if (!input) return;

    if (drop) {
      var iconEl = P.qs('.upload-drop__icon', drop);
      if (iconEl) iconEl.innerHTML = P.icon('upload', 26);
      ['dragenter', 'dragover'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) {
          e.preventDefault();
          drop.classList.add('is-over');
        });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) {
          e.preventDefault();
          drop.classList.remove('is-over');
        });
      });
      drop.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files) handle(e.dataTransfer.files);
      });
    }

    input.addEventListener('change', function () {
      handle(input.files);
      input.value = '';
    });

    async function handle(fileList) {
      var files = Array.prototype.slice.call(fileList || []).filter(function (f) { return /^image\//.test(f.type); });
      if (!files.length) { P.toast(T('media.noImage'), 'warn'); return; }

      var maxW = Number(P.qs('#optWidth').value) || 1280;
      var quality = Math.min(100, Math.max(30, Number(P.qs('#optQuality').value) || 82)) / 100;

      for (var i = 0; i < files.length; i++) {
        var row = document.createElement('div');
        row.className = 'upload-item';
        row.innerHTML = '<div class="skeleton" style="width:96px;height:72px;border-radius:10px"></div><div class="upload-item__body"><b>' +
          P.esc(files[i].name) + '</b><small>' + P.esc(T('media.processing')) + '</small></div>';
        results.prepend(row);
        try {
          var out = await process(files[i], maxW, quality);
          render(row, out);
        } catch (err) {
          row.innerHTML = '<div class="upload-item__body"><b>' + P.esc(files[i].name) + '</b><small style="color:var(--danger)">' + P.esc(err.message || T('media.failed')) + '</small></div>';
        }
      }
    }

    function process(file, maxW, quality) {
      return new Promise(function (resolve, reject) {
        if (file.size > 10 * 1024 * 1024) return reject(new Error(T('media.tooBig')));
        var img = new Image();
        var url = URL.createObjectURL(file);
        img.onload = function () {
          var w = img.naturalWidth, h = img.naturalHeight;
          var scale = Math.min(1, maxW / w);
          var cw = Math.round(w * scale), ch = Math.round(h * scale);
          var canvas = document.createElement('canvas');
          canvas.width = cw; canvas.height = ch;
          var ctx = canvas.getContext('2d');
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, cw, ch);
          canvas.toBlob(function (blob) {
            URL.revokeObjectURL(url);
            if (!blob) return reject(new Error(T('media.converted')));
            var name = P.slugify(file.name.replace(/\.[^.]+$/, '')) + '.webp';
            var path = (P.CFG.mediaDir || 'assets/img') + '/' + name;
            resolve({ name: name, path: path, blob: blob, w: cw, h: ch, size: blob.size, origSize: file.size, dataUrl: URL.createObjectURL(blob) });
          }, 'image/webp', quality);
        };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error(T('media.unreadable'))); };
        img.src = url;
      });
    }

    function render(row, out) {
      var saved = out.origSize ? Math.max(0, Math.round((1 - out.size / out.origSize) * 100)) : 0;
      row.innerHTML = [
        '<img src="' + out.dataUrl + '" alt="" style="width:96px;height:72px;object-fit:cover;border-radius:10px;border:1px solid var(--line)">',
        '<div class="upload-item__body">',
        '<b>' + P.esc(out.name) + '</b>',
        '<small>' + out.w + '×' + out.h + ' · ' + kb(out.size) + (saved ? ' · ' + P.esc(T('media.smaller', { n: saved })) : '') + '</small>',
        '<span class="file-pill" style="font-size:.72rem;padding:4px 8px">' + P.esc(out.path) + '</span>',
        '</div>',
        '<div class="upload-item__actions">',
        '<button class="btn btn--ghost btn--sm" type="button" data-copy>', P.icon('copy', 14), P.esc(T('media.copyPath')) + '</button>',
        '<button class="btn btn--soft btn--sm" type="button" data-dl>', P.icon('download', 14), P.esc(T('media.download')) + '</button>',
        '</div>'
      ].join('');

      P.qs('[data-copy]', row).addEventListener('click', async function () {
        var ok = await P.copyText(out.path);
        P.toast(ok ? T('media.pathCopied', { path: out.path }) : T('media.copyFailed'), ok ? 'success' : 'error');
      });
      P.qs('[data-dl]', row).addEventListener('click', function () {
        var a = document.createElement('a');
        a.href = out.dataUrl;
        a.download = out.name;
        a.click();
        P.toast(T('media.downloaded', { name: out.name }), 'success');
      });
    }

    function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  });
})();

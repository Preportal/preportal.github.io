/* =====================================================================
   PrePortal — otomatik hard-refresh (Ctrl+F5)
   Sayfa her açıldığında ve yenilendiğinde asset'leri önbelleksiz yükler.
   Periyodik yenileme YOK — sadece sayfa açılınca / refresh'te çalışır.
   ===================================================================== */
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker
        .register('/sw.js')
        .then(function (reg) {
          /* yeni SW varsa hemen aktif et */
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'PREPORTAL_FORCE_WAIT' });
          }
        })
        .catch(function () {
          /* SW kayıt başarısızsa sessizce devam et */
        });
    });

    /* arka plan güncelleme kontrolü */
    navigator.serviceWorker.addEventListener('message', function (event) {
      if (event.data && event.data.type === 'PREPORTAL_FORCE_WAIT') {
        navigator.serviceWorker.controller.postMessage({ type: 'PREPORTAL_FORCE_WAIT' });
      }
    });
  }
})();

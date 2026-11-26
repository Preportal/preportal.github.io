/* =====================================================================
   PrePortal — hard-refresh service worker
   Her sayfa yüklemesinde / yenilemede önbelleği atlar (Ctrl+F5 davranışı).
   Sayfa açıldığında ve refresh yapıldığında asset'ler her zaman taze gelir.
   ===================================================================== */
self.addEventListener('fetch', function (event) {
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .catch(function () {
        /* no-store başarısız olursa normal fetch */
        return fetch(event.request);
      })
  );
});

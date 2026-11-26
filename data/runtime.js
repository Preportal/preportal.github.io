/**
 * PrePortal — runtime ayarları (özel CSS / JS, ek HTML, reklamlar)
 * ------------------------------------------------------------------
 * Bu dosya yönetim panelindeki "Görünüm" ve "Reklamlar" bölümlerinden üretilir.
 * Her sayfada data/config.js'ten hemen sonra yüklenir.
 */
window.PREPORTAL_RUNTIME = {
  customCss: '',
  customJs: '',
  headHtml: '',
  ads: {
    enabled: false,
    slots: []
  }
};

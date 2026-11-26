/**
 * PrePortal — site yapılandırması (configuration)
 * Bu dosya her sayfada ilk yüklenen dosyadır. GitHub Pages'te yayına alırken
 * yalnızca buradaki değerleri değiştirmeniz yeterli.
 * Arayüz metinleri burada DEĞİL, lang/<code>.json dosyalarındadır.
 */
window.PREPORTAL_CONFIG = {

  /* Yönetim panelinden yapılan ek ayarlar (özel CSS/JS, reklamlar) */
  runtime: window.PREPORTAL_RUNTIME || null,

  /* İçerik klasörü (yazı dosyaları) — motor bu klasörü tarar */
  dataDir: 'data',

  /* Site kimliği */
  siteName: 'PrePortal',
  siteUrl: 'https://preportal.github.io/', // GitHub Pages adresiniz (sonunda / olsun)
  description: 'PrePortal — APK, oyun ve yazılım incelemeleri, rehberler ve güncelleme notları.',
  logo: 'assets/img/logo.png',

  /* Diller: lang/<code>.json · ilk sıradaki yedek dil (fallback) olur */
  langs: ['en', 'tr', 'ru'],
  defaultLang: 'en',
  langDir: 'lang',

  /* Otomatik yazı keşfi: public GitHub deposu (token gerekmez).
   * GitHub Pages proje adresinde fork sahibi otomatik algılanır. */
  contentRepository: {
    owner: 'Preportal',
    repo: 'preportal.github.io',
    branch: 'main'
  },

  /* İçerik klasörleri (GitHub reposundaki gerçek klasör adları) */
  postsDir: 'p',            // gönderiler: p/<slug>.js
  usersDir: 'users',        // yazarlar:  users/<user>.js
  categoryDir: 'category',  // kategoriler: category/<category>.js
  mediaDir: 'assets/img',   // görseller

  /* Katalog sayfaları: hangi kategori hangi sayfada gösterilecek */
  catalogs: {
    apps: 'uygulamalar',
    games: 'oyunlar'
  },

  /* Görsel barındırma:
   * - 'repo'   : görseller repoya konur (assets/img), yollar olduğu gibi kalır
   * - 'imgbb'  : ImgBB API anahtarı girilirse yüklenen görseller ImgBB'ye gider
   * - 'github' : GitHub token'ı girilirse görseller repoya API ile yüklenir
   */
  media: {
    mode: 'repo',
    imgbbKey: '',
    githubToken: '',
    githubOwner: '',
    githubRepo: '',
    githubBranch: 'main'
  },

  /* Yorumlar — Disqus shortname (boş bırakılırsa yorum alanı bilgi gösterir) */
  disqus: {
    shortname: 'preportal',   // https://<shortname>.disqus.com  →  'preportal'
    pageIdentifier: 'url'     // 'url' | 'slug'  ('url' önerilir: yorumlar taşınabilir kalır)
  },

  /* Sayfalama */
  perPage: 12,

  /* İlk ziyaretçiye gösterilen bilgi bandı (kapatılabilir) */
  intro: {
    enabled: false,
    key: 'intro.main'         // metin: lang/<code>.json içindeki anahtar
  },

  /* Sosyal / bağlantılar */
  social: {
    telegram: '',
    x: '',
    github: '',
    rss: ''
  },

  /* Tema */
  theme: {
    accent: '#2f6bff',
    accent2: '#22d3ee',
    defaultMode: 'dark'       // 'dark' | 'light' | 'system'
  }
};

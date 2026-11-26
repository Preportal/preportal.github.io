# PrePortal

Statik ama dinamik blog: HTML + CSS + JavaScript. Sunucu yok, veritabanı yok — GitHub Pages'te çalışır.

## Yapı

```
index.html         Ana sayfa (öne çıkan + son yazılar + kategoriler)
blog.html          Tüm yazılar: arama, kategori, etiket, sıralama, sayfalama
category.html      Kategoriler (/ category.html?cat=slug → kategori arşivi)
apps.html          Apps kataloğu (kategori: apps)
games.html         Games kataloğu (kategori: games)
post.html          Yazı sayfası  → post.html?slug=...
user.html          Yazar profili → user.html?u=...
create.html        Yayın stüdyosu (CKEditor 5 + yayın aracı)
upload.html        Görsel hazırlama (tarayıcıda WebP sıkıştırma)
admin.html         İçerik yönetimi (data/*.js dizinleri + tutarlılık uyarıları)
about.html         Hakkında
privacy.html       Gizlilik ve çerezler

p/                 Gönderiler        → p/<slug>.js
users/             Yazarlar          → users/<user>.js
category/          Kategoriler       → category/<slug>.js
lang/              Dil dosyaları     → lang/en.json, tr.json, ru.json

p/index.js         Yedek yazı listesi (normal yayında elle güncelleme gerekmez)
data/config.js     Site ayarları (adres, Disqus, medya, tema)
data/runtime.js    Panelden gelen özel CSS/JS/reklamlar
data/search-index.js  İsteğe bağlı arama hızlandırıcısı (boş olabilir)

assets/css/theme.css   Tema (koyu/teknolojik, açık mod dahil)
assets/js/i18n.js      Dil motoru: lang/*.json yükler, data-i18n etiketlerini çevirir
assets/js/core.js      Çekirdek: yükleme, kartlar, arama, tema, dil menüsü, Fancybox, Disqus
assets/js/home.js      Ana sayfa
assets/js/archive.js   Arşiv / kategori / apps / games
assets/js/post.js      Yazı sayfası
assets/js/user.js      Yazar sayfası
assets/js/engine.js    İçerik motoru (keşif + önbellek + teşhis)
assets/js/publisher.js Dosya üretici (p/, category/, users/)
assets/js/create.js    Stüdyo arayüzü

vendor/ckeditor5/      CKEditor 5 (yerel, CDN yok) — yalnızca create.html yükler
vendor/fancybox/       Fancybox 6 (yerel, CDN yok) — sayfa görsel açtığında yüklenir
```

## Yeni yazı ekleme (Node yok, sunucu yok, derleme yok)

```bash
1) create.html  →  yazıyı yaz  →  Yayın aracı  →  p/<slug>.js indir
2) dosyayı repoya at:  p/<slug>.js
3) commit & push (canlı site yazıyı otomatik bulur)
```

Ana sayfa, arama, kategoriler ve yazar sayfası yazıyı **kendiliğinden** gösterir.
`data/posts.js`, arama indeksi, sayaçlar — hepsi tarayıcıda üretilir.

## İçerik motoru (`assets/js/engine.js`)

"Dinamik ama statik" sistemin kalbi. Tamamı tarayıcıda çalışır; hiçbir
Node/React/sunucu tarafı kodu yoktur.

Yazı listesini şu sırayla bulur (biri olmazsa sonrakine geçer):

1. GitHub Tree API → `data/config.js` içindeki `contentRepository` (public depo, token gerekmez)
2. Son tarama önbelleği (`localStorage`, 24 saat)
3. `p/index.js` ve diğer statik yedek listeler
4. Slug tahmini (sayfadaki bağlantılar + bilinen örnek)

Varsayılan içerik deposu `Preportal/preportal.github.io`'dur. GitHub Pages üzerinde
aynı repo adıyla yayımlanan fork, kendi deposundan içerik keşfeder. Özel alan adı
veya farklı repo adı için `data/config.js` içindeki `contentRepository` ayarlanabilir.
Canlı sitede GitHub API sınırına veya erişim hatasına ulaşılırsa yedekler devreye girer.

### Yerelde otomatik keşif

Repo kökünde Python'un dahili HTTP sunucusunu başlatın:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Tarayıcıda http://127.0.0.1:8000/ adresini açın. Motor, yerel `p/` klasörünün
HTTP dizin listesinden yazıları bulur. Dosya ekledikten veya sildikten sonra
sayfayı yenilemek yeterlidir. GitHub API, internet bağlantısı, Node veya derleme
gerekmez. Apache/nginx autoindex de desteklenir. Klasör listeleme kapalıysa
önbellek ve statik yedek listeler kullanılır; `file://` doğrudan açıldığında
tarayıcı güvenlik kısıtlamaları nedeniyle otomatik klasör taraması garanti edilmez.

Kategori ve yazarlar `category/` ve `users/` klasörlerinden okunur.
Bulunan her yazı `window.PREPORTAL_POST.register()` ile kaydedilir; bütün
sayfalar aynı kayıttan okur.

```js
// Konsolda teşhis
PrePortalEngine.report()      // hangi kaynak, kaç yazı, son tarama
PrePortalEngine.refresh()     // yeniden tara (yedek önbelleği korur)
PrePortalEngine.registerPost({ slug: 'test', title: 'Test', ... })
```

- İçerik adresleri geçerli sayfanın klasörüne göre çözülür; yerel testler canlı siteden içerik çekmez.
- Yönetim panelinde **Genel bakış → İçerik motoru** kartı hangi kaynağın
  kullanıldığını ve kaç yazı bulunduğunu gösterir; **Yeniden tara** düğmesi vardır.
- Yazı yoksa site bozulmaz: boş durum mesajı gösterilir.

## Diller (i18n)

Arayüzdeki **hiçbir metin koda gömülü değildir**. Tüm yazılar `lang/<kod>.json`
dosyalarından gelir:

```
lang/en.json   İngilizce (varsayılan / fallback)
lang/tr.json   Türkçe
lang/ru.json   Rusça
```

- Sağ üstteki **küre (globe) ikonu** dil menüsünü açar; seçim `localStorage`
  (`preportal:lang`) içinde saklanır ve tüm sayfalarda geçerli olur.
- Adrese `?lang=tr` ekleyerek de dil seçilebilir (seçim hatırlanır).
- HTML'de kullanım: `data-i18n="nav.blog"` (düz metin), `data-i18n-html="..."` (HTML),
  `data-i18n-tpl="..."` (`{site}`, `{year}` yer tutucuları),
  `data-i18n-attr="placeholder:search.placeholder"` (öznitelik).
- JS'de kullanım: `P.t('post.readingTime', { n: 4 })`.
- Kategori adları/açıklamaları da dildedir: `categoryNames.<slug>.name`.
- Tarih/sayı biçimi ve Fancybox arayüzü seçilen dile göre değişir.

### Dil değişimi ANINDA olur (sayfa yenilenmez)

Küre ikonundan dil seçildiğinde **sayfadaki her şey** aynı saniyede yenilenir:
menü, altbilgi, arama kutusu, sekme adları, kart rozetleri, kategori adları,
yazı sayfasının etiketleri, yorum alanı teması ve admin paneli.

Bunu yapan üç kural:

1. **İskelet** (`core.js` → `init`) `PP_I18N.onLangChange()` ile menüyü, aramayı
   ve altbilgiyi yeniden kurar. Tek yerden yönetilir, her sayfada çalışır.
2. **Sayfa içerikleri** kendi `preportal:lang` dinleyicisiyle yeniden çizilir:
   `home.js`, `archive.js`, `post.js`, `user.js`, `admin.js`.
   Çizim fonksiyonu dışarı alınır ve ilk çizimde bir kez çağrılır.
3. **İlk çizim doğru dilde**: her sayfa `await PP_I18N.whenReady()` bekler,
   böylece sözlük yüklenmeden önce yanlış dilde metin basılmaz.

Yeni bir sayfa/dinamik bölüm eklerken aynı deseni kullanın:

```js
document.addEventListener('preportal:lang', render);   // dil değişince
render();                                              // ilk çizim
```

Tekrar çizimde dinleyicilerin çoğalmaması için `addEventListener` yerine
`onclick` / `dataset.bound` kullanın (mevcut sayfalar böyle yapıyor).
- Yeni dil eklemek: `lang/xx.json` dosyasını kopyalayıp çevirin, sonra
  `data/config.js` içindeki `langs` dizisine `'xx'` ekleyin.
- Klasör/dosya adları İngilizcedir (`p/`, `users/`, `category/`, `lang/`, `data/`, `assets/`).

## Ayarlar (`data/config.js`)

- `siteUrl` → `https://kullaniciadin.github.io/preportal/`
- `disqus.shortname` → Disqus shortname (boşsa yorum alanı gizli/uyarı gösterir)
- `media.mode` → `repo` (görselleri repoya kendiniz eklersiniz), `imgbb` (API anahtarı ile), `github` (token ile API üzerinden)
- `perPage` → arşivde sayfa başına yazı
- `langs` → desteklenen diller (`['en','tr','ru']`), `defaultLang` → `'en'`

## Yorumlar (Disqus)

Her yazının **kendi yorum konusu** vardır; kimlik yazının slug'ından üretilir
(`preportal-article-<slug>`), adres ise `siteUrl + post.html?slug=<slug>`.
Bu sayede site adresi değişse bile yorumlar kaybolmaz, dile göre yeniden bağlanır.

```js
// data/config.js
disqus: { shortname: 'preportal', pageIdentifier: 'url' }
```

- `shortname` yalnızca Disqus panelindeki kısa ad (ör. `preportal`).
- Disqus yüklenemezse/engellenirse ziyaretçiye bilgi kartı ve "yorumları yeni
  sekmede aç" bağlantısı gösterilir; sayfa bozulmaz.
- `localhost`/`127.0.0.1` Disqus panelindeki alan adıyla eşleşmediği için
  geliştirmede bazı istekler engellenir (CORS uyarısı); canlı alan adında sorun çıkmaz.

## Anahtar kelimeler (SEO, gizli)

Yazı dosyasına eklenen `keywords` alanı **okuyucuya hiçbir yerde gösterilmez**;
yalnızca arama, `meta[name=keywords]`, JSON-LD Article şeması ve arama indeksi için
kullanılır. Sınır yoktur (dizi veya virgülle ayrılmış metin).

```js
window.PREPORTAL_POST.register({
  slug: 'office-indir',
  title: 'Office indir',
  keywords: ['office indir', 'ofis indir', 'ms office apk', 'install'],
  ...
});
```

- Site içi arama: başlık > anahtar kelime > etiket > kategori > özet > içerik
  ağırlıklı puanlama; Türkçe/Rusça harfler sadeleştirilir (`İndir` = `indir`),
  kelime başlarıyla da eşleşir (`kurul` → `kurulum`).
- Yayın stüdyosunda **Anahtar kelimeler (SEO)** alanı vardır; geri sayar, sınır koymaz.
- Arama motorları için `node tools/build-index.js` çalıştırın: `data/search-index.js`
  yeniden üretilir (başlık, özet, etiketler, anahtar kelimeler, aranabilir metin).

## Notlar

- CDN kullanılmaz: CKEditor ve Fancybox repoda `vendor/` altındadır.
- Görseller repoda olduğu için mutlak yol kullanmayın; `assets/img/...` yeterlidir.

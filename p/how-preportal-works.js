/**
 * PrePortal — sample post (demo content)
 * Shows the keywords field: searchable, but never shown on the page.
 */
window.PREPORTAL_POST.register({
  slug: 'how-preportal-works',
  title: 'How PrePortal works: a static site that feels dynamic',
  excerpt: 'How can a serverless blog feel dynamic? A walk through the PrePortal file layout, the publishing flow and how JavaScript builds the pages.',
  category: 'news',
  author: 'preportal',
  date: '2026-01-12T10:00:00.000Z',
  updated: '2026-01-12T10:00:00.000Z',
  tags: ['preportal', 'github-pages', 'javascript', 'guide'],
  /* SEO: arama ve robotlar için, sayfada gösterilmez */
  keywords: [
    'statik blog nasıl kurulur',
    'github pages blog',
    'sunucusuz site',
    'static site no server',
    'preportal nedir',
    'javascript ile blog',
    'ckeditor blog yazısı'
  ],
  cover: '',
  featured: true,
  platform: 'Web',
  content: '<p>PrePortal hosts no server: every page is plain HTML, CSS and JavaScript. Content still behaves dynamically, because each post is a small JavaScript file inside the <code>p/</code> folder and the pages read those files in the browser and build themselves instantly.</p><h2>Folder layout</h2><ul><li><code>p/</code> — posts (<code>p/slug.js</code>)</li><li><code>users/</code> — authors (<code>users/user.js</code>)</li><li><code>category/</code> — categories (<code>category/slug.js</code>)</li><li><code>lang/</code> — language packs (<code>en.json</code>, <code>tr.json</code>, <code>ru.json</code>)</li><li><code>data/</code> — site settings and optional caches</li></ul><blockquote>No index files are needed: the content engine finds the post files itself, in the browser.</blockquote><h2>Publishing flow</h2><ol><li>Write the post in the publishing studio (CKEditor 5).</li><li>On the “Publish tool” tab, download the generated <code>p/slug.js</code> file.</li><li>Add the file to the repository and add the slug to <code>p/index.js</code> (or skip it — the engine also finds the file on its own).</li><li>Commit &amp; push — GitHub Pages publishes within seconds.</li></ol><h2>Comments</h2><p>Every post has its own Disqus thread, identified by the post slug, so the conversation stays with the article even if the site moves.</p><h2>Languages</h2><p>Every interface string lives in a JSON language pack under <code>lang/</code>. The globe button in the header switches between English, Turkish and Russian, and the choice is remembered in the browser.</p>'
});

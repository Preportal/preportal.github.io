#!/usr/bin/env node
/**
 * PrePortal — ikon kataloğu üretici
 * ---------------------------------------------------------------------
 * assets/icons/ altındaki SVG dosyalarını tarar ve
 * assets/icons/catalog.js dosyasını üretir:
 *
 *   window.PREPORTAL_ICON_CATALOG = {
 *     meta:    { version, generated, sets, defaultSet, defaultStyle },
 *     sets:    { tabler: { outline: [...adlar], filled: [...] }, lucide: { outline: [...] } },
 *     aliases: { ... }
 *   };
 *
 * İkon adları böylece TEK bir yerden (klasörden) gelir; hiçbir dosyada
 * elle ikon listesi tutulmaz.
 *
 * Kullanım:
 *   node tools/build-icons.js            → katalog + özet (hash) dosyası üretir
 *   node tools/build-icons.js --check    → katalog güncel değilse hata koduyla çıkar
 *   node tools/build-icons.js --list     → adları yazdırır
 *
 * Yeni ikon ekledikten sonra bu betiği çalıştırın (veya sayfayı açın:
 * katalog yoksa ikon motoru yerleşik çizimlerle çalışmaya devam eder).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const ICONS_DIR = path.join(ROOT, 'assets', 'icons');
const OUT_CATALOG = path.join(ICONS_DIR, 'catalog.js');
const OUT_HASH = path.join(ROOT, 'data', 'icons.hash.js');

/* Klasör adı → set adı. İç içe stiller (tabler/outline, tabler/filled).
   Klasör adı "-icons" sonekiyle gelirse (tabler-icons) sadeleştirilir. */
const SKIP_DIRS = new Set(['node_modules', '.git']);

function setKey(dirName) {
  return String(dirName).replace(/-icons?$/i, '') || String(dirName);
}

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch (e) { return false; }
}

function svgFiles(dir) {
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.svg'))
      .map((f) => f.slice(0, -4))
      .sort();
  } catch (e) {
    return [];
  }
}

/** Verilen set sözlüğünde tercih edilen stil adı */
function defaultStyleOf(styles) {
  const keys = Object.keys(styles || {});
  if (keys.includes('outline')) return 'outline';
  if (keys.includes('filled')) return 'filled';
  return keys[0] || 'outline';
}

/** assets/icons/<set>/<style>/*.svg ve assets/icons/<set>/*.svg */
function scan() {
  const sets = {};
  if (!isDir(ICONS_DIR)) return sets;
  for (const entry of fs.readdirSync(ICONS_DIR)) {
    const setDir = path.join(ICONS_DIR, entry);
    if (!isDir(setDir) || SKIP_DIRS.has(entry)) continue;
    const key = setKey(entry);
    const subDirs = fs.readdirSync(setDir).filter((d) => isDir(path.join(setDir, d)) && !SKIP_DIRS.has(d));
    const own = svgFiles(setDir).filter((f) => !/^icon\.schema$/i.test(f));
    if (own.length) sets[key] = Object.assign(sets[key] || {}, { outline: own });
    for (const style of subDirs) {
      const list = svgFiles(path.join(setDir, style));
      if (!list.length) continue;
      /* "icons" gibi alt klasörler stil değil, aynı setin ek ikonlarıdır:
         ayrı stil sayılmaz, setin ana listesine eklenir (lucide/icons). */
      const isStyle = /^(outline|filled|solid|duotone|sharp|regular|bold|light|thin|brands)$/i.test(style);
      sets[key] = sets[key] || {};
      if (isStyle) {
        sets[key][style] = list;
      } else {
        const base = sets[key].outline || sets[key][defaultStyleOf(sets[key])] || [];
        const merged = Array.from(new Set(base.concat(list))).sort();
        sets[key].outline = merged;
      }
    }
  }
  return sets;
}

/**
 * Eski/alternatif adlar → gerçek dosya adı.
 * Eşleme yalnızca hedef dosya gerçekten varsa yazılır.
 */
const ALIAS_SOURCE = {
  /* arayüz (core.js) adları — dosyada olmayan adlar buraya */
  home: 'book',
  pen: 'pencil',
  settings: 'adjustments',
  lock: 'shield',
  close: 'x',
  menu: 'menu-2',
  sparkle: 'sparkles',
  grid: 'apps',
  globe: 'world',
  chevron: 'chevron-down',
  arrowLeft: 'arrow-left',
  arrowRight: 'arrow-right',
  /* eski kategori dosyalarındaki adlar */
  upload: 'cloud-upload',
  minus: 'circle-minus',
  package: 'box',
  refresh: 'relation-many-to-many',
  megaphone: 'ad',
  save: 'device-floppy',
  smartphone: 'device-mobile',
  gamepad: 'device-gamepad',
};

function allNames(sets) {
  const out = new Set();
  for (const set of Object.keys(sets)) {
    for (const style of Object.keys(sets[set])) {
      for (const n of sets[set][style]) {
        if (typeof n === 'string') out.add(n);
      }
    }
  }
  return out;
}

function buildAliases(sets) {
  const names = allNames(sets);
  const aliases = {};
  for (const [from, to] of Object.entries(ALIAS_SOURCE)) {
    if (!names.has(from) && names.has(to)) aliases[from] = to;
  }
  return aliases;
}

/** lucide/*.json → { ad: ['etiket', …] } (yalnızca gerçek ikon adları) */
function buildTags(sets) {
  const tags = {};
  const lucideDir = path.join(ICONS_DIR, 'lucide');
  const names = new Set((sets.lucide && sets.lucide.outline) || []);
  for (const name of names) {
    const jsonPath = fs.existsSync(path.join(lucideDir, name + '.json'))
      ? path.join(lucideDir, name + '.json')
      : path.join(lucideDir, 'icons', name + '.json');
    if (!fs.existsSync(jsonPath)) continue;
    try {
      const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const list = []
        .concat(Array.isArray(j.tags) ? j.tags : [])
        .concat(Array.isArray(j.categories) ? j.categories : [])
        .filter((t) => typeof t === 'string' && t.charAt(0) !== '$')
        .map((t) => t.toLowerCase());
      if (list.length) tags[name] = Array.from(new Set(list)).sort();
    } catch (e) { /* bozuk json: atla */ }
  }
  return tags;
}

/** Editörde gösterilecek hazır gruplar (yalnızca var olan adlar) */
const GROUP_SOURCE = {
  'category-icons': ['apps', 'device-mobile', 'device-gamepad', 'device-desktop', 'device-laptop', 'books', 'book',
    'file-text', 'chart-bar', 'folder', 'folders', 'box', 'briefcase', 'building-store', 'category',
    'certificate', 'award', 'code', 'cloud', 'database', 'bug', 'compass', 'adjustments', 'brush', 'camera',
    'browser', 'file', 'files', 'clipboard', 'bolt', 'flame', 'star', 'heart', 'book-2', 'device-tv', 'world'],
  'interface': ['apps', 'adjustments', 'user', 'search', 'x', 'menu-2', 'chevron-down', 'arrow-left',
    'arrow-right', 'download', 'cloud-upload', 'copy', 'trash', 'check', 'plus', 'circle-minus', 'eye', 'clock',
    'link', 'shield', 'sparkles', 'book', 'pencil', 'folder', 'device-floppy', 'star', 'heart', 'bolt'],
};

function buildGroups(sets) {
  const names = allNames(sets);
  const groups = {};
  for (const [key, list] of Object.entries(GROUP_SOURCE)) {
    const found = list.filter((n) => names.has(n));
    if (found.length) groups[key] = found;
  }
  return groups;
}

function defaultSetFor(sets) {
  if (sets.lucide) return 'lucide';
  const keys = Object.keys(sets);
  return keys.length ? keys[0] : '';
}

function defaultStyleFor(sets, set) {
  const styles = Object.keys(sets[set] || {});
  if (styles.includes('outline')) return 'outline';
  return styles[0] || '';
}

function build() {
  const sets = scan();
  const version = crypto.createHash('sha1')
    .update(JSON.stringify(sets))
    .digest('hex')
    .slice(0, 10);
  const catalog = {
    meta: {
      version,
      /* sürümden türetilir: aynı ikonlar → aynı dosya (--check kararlı olsun) */
      generated: new Date(Date.UTC(2026, 0, 1) + parseInt(version.slice(0, 6), 16) * 1000).toISOString(),
      defaultSet: defaultSetFor(sets),
      defaultStyle: defaultStyleFor(sets, defaultSetFor(sets)),
      sets: Object.keys(sets).reduce((acc, s) => {
        acc[s] = Object.keys(sets[s]).reduce((a, st) => { a[st] = sets[s][st].length; return a; }, {});
        return acc;
      }, {}),
    },
    /* aliases: eski/alternatif ad → gerçek dosya adı.
       Yalnızca gerçekten dosyası olan hedefler eklenir (ölü kayıt olmaz). */
    aliases: buildAliases(sets),
    /* tags: arama için etiketler (lucide *.json tags/categories) */
    tags: buildTags(sets),
    /* groups: editörde hazır kategoriler (ör. kategori ikonları) */
    groups: buildGroups(sets),
    sets,
  };
  return catalog;
}

function render(catalog) {
  const body = JSON.stringify(catalog, null, 2)
    /* okunabilirlik: ad dizileri tek satır */
    .replace(/\[\n\s+("[^\]]*?")\n\s+\]/g, (m, inner) => '[' + inner.replace(/\n\s+/g, ' ') + ']');
  return [
    '/* =====================================================================',
    '   PrePortal — ikon kataloğu (OTOMATİK ÜRETİLDİ, ELLE DÜZENLEMEYİN)',
    '   Üretici: node tools/build-icons.js',
    '   Kaynak : assets/icons/<set>/<style>/*.svg',
    '   Sürüm  : ' + catalog.meta.version + ' · ' + catalog.meta.generated,
    '   ===================================================================== */',
    'window.PREPORTAL_ICON_CATALOG = ' + body + ';',
    '',
  ].join('\n');
}

function renderHash(catalog) {
  return [
    '/* PrePortal — ikon kataloğu sürümü (otomatik üretildi) */',
    'window.PREPORTAL_ICON_VERSION = ' + JSON.stringify(catalog.meta.version) + ';',
    '',
  ].join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const catalog = build();

  if (args.includes('--list')) {
    for (const set of Object.keys(catalog.sets)) {
      for (const style of Object.keys(catalog.sets[set])) {
        console.log('# ' + set + '/' + style + ' (' + catalog.sets[set][style].length + ')');
        console.log(catalog.sets[set][style].join(' '));
      }
    }
    return;
  }

  const text = render(catalog);
  const hashText = renderHash(catalog);

  if (args.includes('--check')) {
    const current = fs.existsSync(OUT_CATALOG) ? fs.readFileSync(OUT_CATALOG, 'utf8') : '';
    if (current !== text) {
      console.error('✖ assets/icons/catalog.js güncel değil — "node tools/build-icons.js" çalıştırın.');
      process.exit(1);
    }
    console.log('✔ ikon kataloğu güncel (' + catalog.meta.version + ')');
    return;
  }

  fs.mkdirSync(path.dirname(OUT_CATALOG), { recursive: true });
  fs.writeFileSync(OUT_CATALOG, text, 'utf8');
  fs.mkdirSync(path.dirname(OUT_HASH), { recursive: true });
  fs.writeFileSync(OUT_HASH, hashText, 'utf8');

  const summary = Object.keys(catalog.sets)
    .map((s) => s + ' ' + Object.keys(catalog.sets[s]).map((st) => st + ':' + catalog.sets[s][st].length).join('/'))
    .join(' · ');
  console.log('✔ assets/icons/catalog.js — sürüm ' + catalog.meta.version);
  console.log('  ' + summary);
}

main();

// בונה את האתר: site/ (קבצים קבועים) + content/ (מה שנערך בפאנל) => dist/
const fs = require('fs'), path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');
let sizeOf = null; try { sizeOf = require('image-size'); } catch (e) {}

const ROOT = __dirname;
const SITE = path.join(ROOT, 'site');
const CONTENT = path.join(ROOT, 'content');
const DIST = path.join(ROOT, 'dist');
const DOMAIN = 'https://www.iris-levy.co.il';
const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'templates', 'tags.json'), 'utf8'));
const TAG = Object.fromEntries(TAGS.map(t => [t.tag, t]));
const ART_TPL = fs.readFileSync(path.join(ROOT, 'templates', 'article.html'), 'utf8');
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

// ---------- עזרים ----------
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escText = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const encPath = p => p.split('/').map(x => encodeURIComponent(x)).join('/');
const ymd = d => {
  if (!d) return '';
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
};
function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(a, b) {
  fs.mkdirSync(b, { recursive: true });
  for (const f of fs.readdirSync(a)) {
    const pa = path.join(a, f), pb = path.join(b, f);
    if (fs.statSync(pa).isDirectory()) copyDir(pa, pb); else fs.copyFileSync(pa, pb);
  }
}
function readFolder(dir) {
  const p = path.join(CONTENT, dir);
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p).filter(f => /\.(md|markdown)$/.test(f)).sort().map(f => {
    const m = matter(fs.readFileSync(path.join(p, f), 'utf8'));
    return { file: f.replace(/\.\w+$/, ''), ...m.data, body: m.content };
  });
}
function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
function slugify(t) {
  return String(t).trim().replace(/[\s_]+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 90) || 'מאמר';
}
function imgDims(src) {
  try {
    if (!sizeOf || !src) return null;
    const p = path.join(SITE, decodeURI(src));
    if (!fs.existsSync(p)) return null;
    const d = sizeOf(p); return { w: d.width, h: d.height };
  } catch (e) { return null; }
}
function sortByOrder(list, dateKey) {
  // פריטים ישנים שומרים על הסדר המקורי; חדשים (בלי order) עולים ראשונים, החדש ביותר קודם
  const neu = list.filter(x => x.order === undefined || x.order === null || x.order === '');
  const old = list.filter(x => !neu.includes(x));
  neu.sort((a, b) => ymd(b[dateKey]).localeCompare(ymd(a[dateKey])));
  old.sort((a, b) => Number(a.order) - Number(b.order));
  return neu.concat(old);
}

// ---------- טעינת תוכן ----------
const settings = JSON.parse(fs.readFileSync(path.join(CONTENT, 'settings', 'site.json'), 'utf8'));
const ORIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'templates', 'settings-original.json'), 'utf8'));

let arts = readFolder('articles').filter(a => a.title && a.draft !== true);
arts = sortByOrder(arts, 'date');
let nextNum = 1 + Math.max(0, ...arts.map(a => (/^a(\d+)$/.exec(a.id || '') || [])[1] || 0).map(Number));
const usedSlugs = new Set();
for (const a of arts) {
  if (!a.id) a.id = 'a' + (nextNum++);
  if (!a.slug) a.slug = /^[a-z]?\d+$/.test(a.file) ? slugify(a.title) : a.file;
  let s = a.slug, k = 2;
  while (usedSlugs.has(s.toLowerCase())) s = a.slug + '-' + (k++);
  a.slug = s; usedSlugs.add(s.toLowerCase());
  a.date = ymd(a.date) || new Date().toISOString().slice(0, 10);
  a.url = '/מאמרים/' + a.slug;
  if (!a.description) a.description = (a.excerpt || '').slice(0, 155);
  if (!a.page_title) a.page_title = a.title + ' | איריס לוי';
  if (!a.excerpt) a.excerpt = a.body.replace(/[#*_>\[\]()-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  const words = a.body.split(/\s+/).filter(Boolean).length;
  if (!a.minutes) a.minutes = Math.max(1, Math.round(words / 160));
}

let revs = readFolder('reviews').filter(r => r.name && r.body && r.body.trim());
revs = sortByOrder(revs, 'date');

let bas = readFolder('before-after').filter(b => b.before);
bas.sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999));

// ---------- dist ----------
rmrf(DIST);
copyDir(SITE, DIST);

// ---------- עמודי מאמרים ----------
const QUIZ = topic => `<div class="qz-inline" data-topic="${esc(topic)}"><span class="qz-kick">שאלון קצר</span><h2 style="margin:0 0 .4rem">רוצה לדעת אם זה מתאים לך?</h2><p style="margin:0 0 1rem">ארבע שאלות קצרות, ואיריס תחזור אלייך לתיאום פגישת אבחון וייעוץ חינם.</p><div aria-hidden="true" class="qz-dots"><i></i><i></i><i></i><i></i><i></i></div><div aria-live="polite" class="qz-body"></div></div>`;
const PHONE_WA = '972558833337';
const encQ = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const waArt = t => `https://wa.me/${PHONE_WA}?text=` + encQ(`היי איריס, קראתי באתר את המאמר "${t}" ואשמח לתאם פגישת אבחון וייעוץ`);
const CTA = (t, extra) => `<div class="midcta${extra || ''}"><div><b>רוצה לדעת אם זה מתאים לך?</b><p>פגישת אבחון וייעוץ ללא עלות.</p></div><a class="pill pill-wa" ${extra ? 'target="_blank" rel="noopener" href="' + waArt(t) + '"' : 'href="' + waArt(t) + '" target="_blank" rel="noopener"'}>לכתוב לאיריס בוואטסאפ</a></div>`;

marked.setOptions({ gfm: true, breaks: false });
function renderBody(a) {
  let md = a.body.replace(/\[\[שאלון:(.*?)\]\]/g, (m, t) => `\n\n<!--QUIZ:${t}-->\n\n`);
  let html = marked.parse(md);
  // הדגשות שה-Markdown לא זיהה (בעברית ליד פיסוק)
  html = html.replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/<p><!--QUIZ:(.*?)--><\/p>|<!--QUIZ:(.*?)-->/g, (m, a1, a2) => QUIZ(a1 || a2));
  // כותרות h3+ -> h2 כדי לשמור על העיצוב
  const heads = [];
  let n = 0;
  html = html.replace(/<h2>(.*?)<\/h2>/g, (m, inner) => { const id = 'ah' + (n++); heads.push({ id, text: inner.replace(/<[^>]+>/g, '') }); return `<h2 id="${id}">${inner}</h2>`; });
  if (heads.length < 3) html = html.replace(/<h2 id="ah\d+">/g, '<h2>');
  // CTA באמצע: לפני הבלוק ה-40%
  const blocks = splitBlocks(html);
  const pos = Math.floor(blocks.length * 0.4);
  blocks.splice(pos, 0, CTA(a.title));
  return { html: blocks.join('\n'), heads };
}
function splitBlocks(html) {
  // מפצל HTML לבלוקים ברמה העליונה
  const out = []; let depth = 0, start = 0;
  const re = /<\/?([a-zA-Z0-9]+)[^>]*?(\/?)>/g; let m;
  const voids = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);
  while ((m = re.exec(html))) {
    const tag = m[1].toLowerCase(); if (voids.has(tag) || m[2] === '/') { if (depth === 0) { out.push(html.slice(start, re.lastIndex).trim()); start = re.lastIndex; } continue; }
    if (m[0][1] === '/') { depth--; if (depth === 0) { out.push(html.slice(start, re.lastIndex).trim()); start = re.lastIndex; } }
    else depth++;
  }
  const rest = html.slice(start).trim(); if (rest) out.push(rest);
  return out.filter(Boolean);
}
const anum = a => { const m = /^a(\d+)$/.exec(a.id); return m ? m[1] : (a.views ? String(a.views) : ''); };
const fmtDate = d => { const [y, mo] = d.split('-'); return MONTHS[Number(mo) - 1] + ' ' + y; };

for (const a of arts) {
  const tg = TAG[a.tag] || { label: a.tag, color: '#E8833A', image: '' };
  const { html, heads } = renderBody(a);
  const hasToc = heads.length >= 3;
  const canonical = DOMAIN + encPath(a.url);
  const byDate = (x, y) => (y.date > x.date ? 1 : y.date < x.date ? -1 : 0);
  const more = arts.filter(x => x !== a && x.tag === a.tag).sort(byDate).slice(0, 6);
  if (more.length < 6) more.push(...arts.filter(x => x !== a && x.tag !== a.tag).slice(0, 6 - more.length));
  const meta = `<span>מאת איריס לוי</span>` + (anum(a) ? `<span class="ga-n">מאמר מס׳ ${anum(a)}</span>` : '') + `<span class="ga-d">${fmtDate(a.date)}</span><span class="ga-m">${a.minutes} דקות קריאה</span>` + (a.views ? `<span class="ga-v">${Number(a.views).toLocaleString('he-IL')} קריאות</span>` : '');
  const img = a.image || tg.image;
  const main = `<main id="top" class="art-page">
<section class="view" id="v-art" data-id="${esc(a.id)}">
  <div class="prog" aria-hidden="true"><i></i></div>
  <header class="post-hero ga-hero" style="--c:${tg.color}">${img ? `<img class="ga-bg" alt="" src="${esc(img)}">` : ''}<div class="wrap"><a class="back" href="/מאמרים">→ לכל המאמרים</a><span class="chip ga-tag">${escText(a.tag)}</span><h1 class="ga-t">${escText(a.title)}</h1><div class="meta">${meta}</div></div></header>
  <div class="wrap post-grid${hasToc ? '' : ' notoc'}">
    ${hasToc ? `<aside class="toc ga-toc" aria-label="תוכן המאמר"><b>במאמר</b>${heads.map(h => `<a href="#${h.id}">${escText(h.text)}</a>`).join('')}</aside>` : ''}
    <div class="post-body">
      <div class="ga-text">${html}</div>
      ${CTA(a.title, ' ga-end')}
    </div>
  </div>
  <section class="more"><div class="wrap"><h2>עוד מאמרים</h2><div class="morerow ga-more">${more.map(x => `<a href="${esc(x.url)}"><span class="chip">${escText(x.tag)}</span><h3>${escText(x.title)}</h3></a>`).join('')}</div></div></section>
</section>
</main>`;
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', headline: a.title, description: a.description, datePublished: a.date, author: { '@type': 'Person', name: 'איריס לוי' }, publisher: { '@type': 'Organization', name: 'איריס לוי', logo: { '@type': 'ImageObject', url: DOMAIN + '/og.jpg' } }, mainEntityOfPage: canonical, image: DOMAIN + '/og.jpg', inLanguage: 'he' },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'דף הבית', item: DOMAIN + '/' }, { '@type': 'ListItem', position: 2, name: 'מאמרים', item: DOMAIN + encPath('/מאמרים') }, { '@type': 'ListItem', position: 3, name: a.title }] }] };
  const page = ART_TPL
    .split('{{page_title}}').join(esc(a.page_title))
    .split('{{description}}').join(esc(a.description))
    .split('{{canonical}}').join(canonical)
    .split('{{jsonld}}').join(JSON.stringify(ld).replace(/</g, '\\u003c'))
    .split('{{main}}').join(main);
  fs.writeFileSync(path.join(DIST, 'מאמרים', a.slug.toLowerCase() + '.html'), page);
}

// ---------- נתוני IRIS בכל העמודים ----------
const cimgs = {}; for (const t of TAGS) if (t.image) cimgs[t.tag] = t.image;
const IRIS = {
  cimgs,
  arts: arts.map(a => {
    const o = { id: a.id, tag: a.tag, t: a.title, ex: a.excerpt, v: Number(a.views) || 0, d: a.date, m: a.minutes, url: a.url };
    for (const k of Object.keys(a)) if (k.startsWith('x_')) o[k.slice(2)] = a[k];
    return o;
  }),
  revs: revs.map(r => {
    const o = { n: r.name, t: r.body.trim().replace(/\s*\n\s*/g, ' '), tag: r.tag || '', d: ymd(r.date) };
    if (r.featured) o.h = 1;
    for (const k of Object.keys(r)) if (k.startsWith('x_')) o[k.slice(2)] = r[k];
    return o;
  }),
};
const irisJs = 'window.IRIS=' + JSON.stringify(IRIS).replace(/</g, '\\u003c') + ';window.IRISB=';

// ---------- לפני ואחרי ----------
function baCase(b, i, capText) {
  const n = b.title || ('מקרה ' + (i + 1));
  const one = !b.after;
  const im = (src, kind) => { const d = imgDims(src); return `<img src="${esc(src)}"${d ? ` width="${d.w}" height="${d.h}"` : ''} alt="${esc(n)}, ${kind}" data-cap="${esc(n)}" loading="lazy" decoding="async">`; };
  return `<figure class="bacase${one ? ' one' : ''}">${im(b.before, 'לפני')}${one ? '' : im(b.after, 'אחרי')}<figcaption>${escText(capText || n)}</figcaption></figure>`;
}
const baFull = bas.map((b, i) => baCase(b, i)).join('');
const baHome = bas.filter(b => b.home).sort((a, b) => (Number(a.home_order) || 99) - (Number(b.home_order) || 99)).slice(0, 3).map((b, i) => baCase(b, i, 'לפני ← אחרי')).join('');

// ---------- טקסטים בדפים ----------
const textEdits = [];
for (const [key, def] of Object.entries(ORIG.fields)) {
  const val = settings[def.mirror || key];
  if (val === undefined || val === null) continue;
  let newHtml;
  if (def.type === 'list') {
    const items = (val || []).map(x => String(typeof x === 'object' ? x.item : x).trim()).filter(Boolean);
    const origItems = [...def.html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => m[1].trim());
    if (JSON.stringify(items) === JSON.stringify(origItems)) continue;
    newHtml = items.map(x => `\n      <li>${escText(x)}</li>`).join('') + '\n    ';
  }
  else if (def.type === 'image') newHtml = esc(val);
  else newHtml = escText(val);
  if (newHtml === def.html) continue;
  textEdits.push([def.before + def.html + def.after, def.before + newHtml + def.after]);
}
const phoneDigits = String(settings.phone || '').replace(/\D/g, '');
const phoneChanged = phoneDigits && phoneDigits !== ORIG.phone;

// ---------- מעבר על כל קבצי ה-HTML ----------
let touched = 0;
for (const f of walk(DIST)) {
  if (!f.endsWith('.html')) continue;
  if (f.includes(path.sep + 'admin' + path.sep)) continue;
  let s = fs.readFileSync(f, 'utf8'), o = s;
  const i = s.indexOf('window.IRIS=');
  if (i >= 0) { const j = s.indexOf(';window.IRISB=', i); s = s.slice(0, i) + irisJs + s.slice(j + ';window.IRISB='.length); }
  s = s.replace(/(<div class="bagrid">)[\s\S]*?(<\/div><\/div><\/section>)/, (m, a, b) => a + baFull + b);
  s = s.replace(/(<div class="bahgrid">)[\s\S]*?(<\/div>(?:<a[^>]*>[^<]*<\/a>)?<\/div><\/section>)/, (m, a, b) => a + baHome + b);
  for (const [from, to] of textEdits) s = s.split(from).join(to);
  if (phoneChanged) {
    const loc = phoneDigits.startsWith('0') ? phoneDigits : '0' + phoneDigits;
    const intl = '972' + loc.slice(1);
    const dash = loc.slice(0, 3) + '-' + loc.slice(3);
    s = s.split(ORIG.phone_intl).join(intl).split(ORIG.phone_dash).join(dash).split(ORIG.phone).join(loc);
  }
  if (s !== o) { fs.writeFileSync(f, s); touched++; }
}

// ---------- קישור הזמנה לפאנל: הפניה ל-/admin ----------
{
  const f = path.join(DIST, 'index.html');
  let s = fs.readFileSync(f, 'utf8');
  const js = '<script>if(/(invite|recovery|confirmation|email_change)_token=/.test(location.hash))location.replace("/admin/"+location.hash);</script>';
  s = s.replace('</head>', js + '\n</head>');
  fs.writeFileSync(f, s);
}

// ---------- רשימת מאמרים (עמוד סטטי) ----------
{
  const f = path.join(DIST, 'רשימת-מאמרים.html');
  let s = fs.readFileSync(f, 'utf8');
  const st = s.indexOf('<h2>', s.indexOf('alist-static')), en = s.indexOf('</div></section></main>', st);
  let lists = '';
  for (const t of TAGS) {
    const l = arts.filter(a => a.tag === t.tag); if (!l.length) continue;
    lists += `<h2>${escText(t.label)} <small>(${l.length})</small></h2><ul>` + l.map(a => `<li><a href="${esc(a.url)}">${escText(a.title)}</a></li>`).join('') + '</ul>';
  }
  s = s.slice(0, st) + lists + s.slice(en);
  s = s.replace(/<p>\d+ מאמרים של איריס לוי/, `<p>${arts.length} מאמרים של איריס לוי`);
  fs.writeFileSync(f, s);
}

// ---------- sitemap ----------
{
  const f = path.join(DIST, 'sitemap.xml');
  let s = fs.readFileSync(f, 'utf8');
  const artPrefix = DOMAIN + encPath('/מאמרים/');
  const lines = s.split('\n').filter(l => !l.includes('<loc>' + artPrefix));
  const today = new Date().toISOString().slice(0, 10);
  const add = arts.map(a => `<url><loc>${DOMAIN + encPath(a.url)}</loc><lastmod>${a.date}</lastmod></url>`);
  const end = lines.findIndex(l => l.includes('</urlset>'));
  lines.splice(end, 0, ...add);
  fs.writeFileSync(f, lines.join('\n'));
}

console.log(`build ok: ${arts.length} מאמרים, ${revs.length} המלצות, ${bas.length} לפני/אחרי, ${textEdits.length} שינויי טקסט, ${touched} עמודים עודכנו`);

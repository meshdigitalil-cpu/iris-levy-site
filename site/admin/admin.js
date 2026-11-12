// תצוגה מקדימה בפאנל: צד ימין מראה את החלק כמו שהוא נראה באתר, ומתעדכן תוך כדי הקלדה
CMS.registerPreviewStyle('https://fonts.googleapis.com/css2?family=Karantina:wght@400;700&display=block');
CMS.registerPreviewStyle('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Hebrew:wght@300;400;600&display=swap');
CMS.registerPreviewStyle('/site.css');
CMS.registerPreviewStyle('/admin/preview.css');

var TAGS = {
  'פנים': { label: 'פנים', color: '#E8833A', image: '/media/2ecc5ae874.jpg' },
  'גב': { label: 'גב', color: '#5E7348', image: '/media/766f42e072.jpg' },
  'ישבן': { label: 'ישבן', color: '#B9725A', image: '' },
  'קרטוזיס': { label: 'קרטוזיס פילאריס', color: '#8A6A4F', image: '/media/dff8a23f6d.jpg' },
  'צלקות': { label: 'צלקות', color: '#6B5646', image: '/media/33ea2e3eda.jpg' },
  'הורמונלי': { label: 'הורמונלי', color: '#C9631F', image: '/media/3fad2ee297.jpg' },
  'מבוגרים': { label: 'מבוגרים', color: '#4E6B3C', image: '/media/30bc3fdc89.jpg' },
  'סבוריאה': { label: 'סבוריאה', color: '#A0522D', image: '/media/17c11702ec.jpg' },
  'הידרדניטיס': { label: 'הידרדניטיס', color: '#7A4E3A', image: '' }
};
var MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
function fmtDate(d) {
  if (!d) return '';
  var s = (d instanceof Date) ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  var p = s.split('-'); return p.length > 1 ? MONTHS[Number(p[1]) - 1] + ' ' + p[0] : s;
}
function asset(props, path) {
  if (!path) return '';
  var a = props.getAsset(path); return a ? a.toString() : path;
}
function val(entry, key) { var v = entry.getIn(['data', key]); return v == null ? '' : v; }
function frame(child) { return h('div', { dir: 'rtl', className: 'pv' }, child); }

// ---------- מאמר ----------
var ArticlePreview = createClass({
  render: function () {
    var e = this.props.entry, tag = val(e, 'tag'), t = TAGS[tag] || { label: tag, color: '#E8833A', image: '' };
    var img = val(e, 'image') ? asset(this.props, val(e, 'image')) : t.image;
    return frame(h('main', { className: 'art-page' },
      h('header', { className: 'post-hero ga-hero', style: { '--c': t.color } },
        img ? h('img', { className: 'ga-bg', alt: '', src: img }) : null,
        h('div', { className: 'wrap' },
          h('a', { className: 'back' }, '→ לכל המאמרים'),
          tag ? h('span', { className: 'chip ga-tag' }, tag) : null,
          h('h1', { className: 'ga-t' }, val(e, 'title') || 'כותרת המאמר'),
          h('div', { className: 'meta' }, h('span', null, 'מאת איריס לוי'), h('span', null, fmtDate(val(e, 'date')))))),
      h('div', { className: 'wrap post-grid notoc' },
        h('div', { className: 'post-body' }, h('div', { className: 'ga-text' }, this.props.widgetFor('body'))))));
  }
});

// ---------- המלצה ----------
var ReviewPreview = createClass({
  render: function () {
    var e = this.props.entry, tag = val(e, 'tag');
    return frame(h('section', { className: 'view pv-section' }, h('div', { className: 'wrap' },
      h('p', { className: 'pv-note' }, 'כך ההמלצה תופיע בעמוד ההמלצות:'),
      h('div', { className: 'rgrid pv-one' },
        h('figure', { className: 'rcard' },
          h('span', { className: 'stars', 'aria-hidden': 'true' }, '★★★★★'),
          h('p', null, val(e, 'body') || 'כאן יופיע הטקסט של ההמלצה'),
          h('div', { className: 'rf' }, h('span', null, val(e, 'name') || 'שם'), tag ? h('span', { className: 'chip' }, (TAGS[tag] || {}).label || tag) : null))))));
  }
});

// ---------- לפני ואחרי ----------
var BAPreview = createClass({
  render: function () {
    var e = this.props.entry, title = val(e, 'title') || 'מקרה', b = val(e, 'before'), a = val(e, 'after');
    return frame(h('section', { className: 'sec pv-section' }, h('div', { className: 'wrap bafull' },
      h('div', { className: 'head' }, h('h2', null, 'לפני ואחרי טיפול')),
      h('div', { className: 'bagrid pv-one' },
        h('figure', { className: 'bacase' + (a ? '' : ' one') },
          b ? h('img', { src: asset(this.props, b), alt: title + ', לפני' }) : h('div', { className: 'pv-empty' }, 'תמונת לפני'),
          a ? h('img', { src: asset(this.props, a), alt: title + ', אחרי' }) : null,
          h('figcaption', null, title))))));
  }
});

// ---------- דף הבית ואודות ----------
var HomePreview = createClass({
  render: function () {
    var e = this.props.entry, list = e.getIn(['data', 'about_list']);
    var items = list ? list.toJS() : [];
    return frame(h('main', null,
      h('section', { className: 'hero' }, h('div', { className: 'hero-card' },
        h('img', { className: 'pv-hero-img', src: '/media/iris-hero-poster.jpg', alt: '' }),
        h('div', { className: 'wordmark', 'aria-hidden': 'true' }, h('span', null, 'איריס'), h('span', null, 'לוי')),
        h('div', { className: 'hero-low' },
          h('div', null,
            h('h1', null, val(e, 'hero_title')),
            h('p', null, val(e, 'hero_text')),
            h('span', { className: 'free' }, val(e, 'hero_free'))),
          h('div', { className: 'exp' }, h('b', { dir: 'ltr' }, val(e, 'years') + '+'), h('span', null, 'שנות ניסיון'))))),
      h('section', { className: 'sec meet' }, h('div', { className: 'wrap meet-grid' },
        h('figure', { className: 'meet-img' }, h('img', { src: asset(this.props, val(e, 'about_image')), alt: '' })),
        h('div', { className: 'meet-txt' },
          h('h2', null, val(e, 'about_title')),
          h('p', { className: 'lead' }, val(e, 'about_lead')),
          h('blockquote', { className: 'mq' }, '”' + val(e, 'about_quote') + '“'),
          h('ul', { className: 'meet-list' }, items.map(function (x, i) { return h('li', { key: i }, typeof x === 'object' ? x.item : x); })),
          h('p', { className: 'meet-who' }, val(e, 'about_who')),
          h('p', { className: 'pv-note' }, 'טלפון באתר: ' + val(e, 'phone')))))));
  }
});

CMS.registerPreviewTemplate('articles', ArticlePreview);
CMS.registerPreviewTemplate('reviews', ReviewPreview);
CMS.registerPreviewTemplate('before-after', BAPreview);
CMS.registerPreviewTemplate('site', HomePreview);

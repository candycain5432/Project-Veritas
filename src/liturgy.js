// ---- Liturgical Calendar ----
// Offline calculation used as a fallback when the public calendar API is unreachable.
function getEaster(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const FIXED_FEASTS = {
  '1-1':'Mary, Mother of God','1-6':'Epiphany of the Lord','1-17':'Saint Anthony the Abbot',
  '1-21':'Saint Agnes','1-24':'Saint Francis de Sales','1-25':'Conversion of Saint Paul',
  '1-28':'Saint Thomas Aquinas','2-2':'Presentation of the Lord','2-5':'Saint Agatha',
  '2-14':'Saints Cyril and Methodius','2-22':'Chair of Saint Peter',
  '3-19':'Saint Joseph','3-25':'Annunciation of the Lord',
  '4-25':'Saint Mark the Evangelist','4-29':'Saint Catherine of Siena',
  '5-3':'Saints Philip and James','5-14':'Saint Matthias','5-31':'Visitation of Mary',
  '6-1':'Saint Justin Martyr','6-13':'Saint Anthony of Padua',
  '6-24':'Nativity of Saint John the Baptist','6-29':'Saints Peter and Paul',
  '7-3':'Saint Thomas the Apostle','7-11':'Saint Benedict','7-22':'Saint Mary Magdalene',
  '7-25':'Saint James the Apostle','7-26':'Saints Joachim and Anne','7-31':'Saint Ignatius of Loyola',
  '8-4':'Saint John Vianney','8-6':'Transfiguration of the Lord','8-10':'Saint Lawrence',
  '8-11':'Saint Clare','8-14':'Saint Maximilian Kolbe','8-15':'Assumption of Mary',
  '8-20':'Saint Bernard','8-22':'Queenship of Mary','8-24':'Saint Bartholomew',
  '8-27':'Saint Monica','8-28':'Saint Augustine','9-8':'Nativity of Mary',
  '9-14':'Exaltation of the Holy Cross','9-15':'Our Lady of Sorrows',
  '9-21':'Saint Matthew','9-23':'Padre Pio','9-27':'Saint Vincent de Paul',
  '9-29':'Saints Michael, Gabriel & Raphael','9-30':'Saint Jerome',
  '10-1':'Saint Thérèse of Lisieux','10-2':'Guardian Angels','10-4':'Saint Francis of Assisi',
  '10-7':'Our Lady of the Rosary','10-15':'Saint Teresa of Ávila','10-18':'Saint Luke',
  '10-28':'Saints Simon and Jude','11-1':'All Saints','11-2':'All Souls',
  '11-11':'Saint Martin of Tours','11-17':'Saint Elizabeth of Hungary',
  '11-21':'Presentation of Mary','11-22':'Saint Cecilia','11-30':'Saint Andrew',
  '12-3':'Saint Francis Xavier','12-6':'Saint Nicholas','12-7':'Saint Ambrose',
  '12-8':'Immaculate Conception','12-12':'Our Lady of Guadalupe','12-13':'Saint Lucy',
  '12-14':'Saint John of the Cross','12-25':'Nativity of the Lord',
  '12-26':'Saint Stephen','12-27':'Saint John the Apostle','12-28':'Holy Innocents',
};

const MOVEABLE = [
  { n: -46, t: 'Ash Wednesday' }, { n: -7, t: 'Palm Sunday' }, { n: -3, t: 'Holy Thursday' },
  { n: -2, t: 'Good Friday' }, { n: -1, t: 'Holy Saturday' }, { n: 0, t: 'Easter Sunday' },
  { n: 1, t: 'Easter Monday' }, { n: 7, t: 'Divine Mercy Sunday' },
  { n: 39, t: 'Ascension of the Lord' }, { n: 49, t: 'Pentecost Sunday' },
  { n: 56, t: 'Trinity Sunday' }, { n: 60, t: 'Corpus Christi' },
];

function getLiturgicalSeason(date, easter) {
  const y = date.getFullYear();
  const ash = addDays(easter, -46), pentecost = addDays(easter, 49);
  const dec25 = new Date(y, 11, 25), dow = dec25.getDay();
  const fourthSun = addDays(dec25, -(dow === 0 ? 7 : dow));
  const advent1 = addDays(fourthSun, -21);
  const epiphany = new Date(y, 0, 13);
  if (date <= epiphany) return 'Christmas Season';
  if (date >= ash && date < easter) return 'Lent';
  if (date >= easter && date <= pentecost) return 'Eastertide';
  if (date >= advent1) return 'Advent';
  return 'Ordinary Time';
}

export function getTodaysFeast(date) {
  const easter = getEaster(date.getFullYear());
  for (const f of MOVEABLE) {
    if (sameDay(date, addDays(easter, f.n))) return { title: f.t, season: getLiturgicalSeason(date, easter) };
  }
  const key = `${date.getMonth() + 1}-${date.getDate()}`;
  if (FIXED_FEASTS[key]) return { title: FIXED_FEASTS[key], season: getLiturgicalSeason(date, easter) };
  return { title: null, season: getLiturgicalSeason(date, easter) };
}

// ---- Public calendar + readings (cpbjr.github.io, same source the app uses) ----
const CAL_BASE = 'https://cpbjr.github.io/catholic-readings-api';

/** Parse 'YYYY-MM-DD' into a local Date, or null if malformed. */
export function parseISODate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 ? d : null;
}

export function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calPath(iso) {
  const [y, m, d] = iso.split('-');
  return `${y}/${m}-${d}.json`;
}

async function getJSON(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

/** { title, type, season } for an ISO date. Falls back to the offline table. */
export async function getLiturgicalDay(iso) {
  try {
    const d = await getJSON(`${CAL_BASE}/liturgical-calendar/${calPath(iso)}`);
    const cel = d.celebration || {};
    return { title: cel.name || null, type: cel.type || null, season: d.season || 'Ordinary Time' };
  } catch {
    const f = getTodaysFeast(parseISODate(iso) || new Date());
    return { title: f.title, type: f.title ? 'FEAST' : 'FERIA', season: f.season };
  }
}

/** { ref, text } of the day's Gospel, text in Douay-Rheims via bible-api.com. */
export async function getGospel(iso) {
  const refs = await getJSON(`${CAL_BASE}/readings/${calPath(iso)}`);
  const ref = refs.readings?.gospel;
  if (!ref) throw new Error('No gospel reference');
  let text = '';
  try {
    const simplified = ref.replace(/\s+and\s+/gi, ',').replace(/\s+/g, ' ').trim();
    const b = await getJSON(`https://bible-api.com/${encodeURIComponent(simplified)}?translation=dra`);
    text = (b.text || '').trim();
  } catch {}
  return { ref, text };
}

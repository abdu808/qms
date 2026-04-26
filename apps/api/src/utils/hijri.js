/**
 * hijri.js — تحويل التاريخ الميلادي إلى هجري
 * خوارزمية Julian Day Number
 */

export function toHijri(date = new Date()) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  let jd = Math.floor((1461 * (y + 4800 + Math.floor((m - 14) / 12))) / 4)
    + Math.floor((367 * (m - 2 - 12 * Math.floor((m - 14) / 12))) / 12)
    - Math.floor((3 * Math.floor((y + 4900 + Math.floor((m - 14) / 12)) / 100)) / 4)
    + d - 32075;

  let l = jd - 1948440 + 10632, n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  let j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719)
    + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
    - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;

  const hYear = 30 * n + j - 30;
  const hMonth = Math.floor((24 * l) / 709);
  const hDay = l - Math.floor((709 * hMonth) / 24);

  const months = [
    'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
    'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
  ];

  return {
    year: hYear,
    month: hMonth,
    day: hDay,
    monthName: months[hMonth - 1] || '',
    formatted: `${hDay} ${months[hMonth - 1] || ''} ${hYear}هـ`,
  };
}

export function formatDateBilingual(date = new Date()) {
  const h = toHijri(date);
  const g = date.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  return `${h.formatted} / ${g}`;
}

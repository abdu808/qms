/**
 * utils/html.js — مساعدات HTML مشتركة للنماذج العامة (بدون مصادقة).
 *
 * escapeHtml — تهريب HTML لمنع هجمات XSS في ردود HTML المولَّدة على الخادم.
 * trimLen    — اقتطاع النص المُدخَل من المستخدم وتحديد حد أقصى للطول (منع DoS).
 */

/**
 * يُهرَّب أي مُدخَل نصي قبل تضمينه في HTML المولَّدة على الخادم.
 * @param {*} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * يُقلِّص النص المُدخَل من المستخدم ويحدّ طوله لمنع تضخيم قاعدة البيانات أو الواجهة.
 * @param {*} v      — القيمة الخام
 * @param {number} max — الحد الأقصى للأحرف
 * @returns {string}
 */
export function trimLen(v, max) {
  return String(v ?? '').trim().slice(0, max);
}

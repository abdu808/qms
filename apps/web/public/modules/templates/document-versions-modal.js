// Auto-extracted from index.html. Keep behavior in app.js/modules; this file only mounts markup.
(() => {
  const html = "<!-- DOCUMENT VERSIONS MODAL (ISO 7.5.3) -->\r\n        <div x-show=\"docVersions?.open\" x-cloak class=\"fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4\" @keydown.escape.window=\"docVersions.open=false\">\r\n          <div class=\"bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl\" @click.outside=\"docVersions.open=false\">\r\n            <div class=\"p-4 border-b flex justify-between items-center\">\r\n              <div>\r\n                <h3 class=\"font-bold text-gray-800\">📋 سجل الإصدارات (ISO 7.5.3)</h3>\r\n                <p class=\"text-xs text-gray-500 mt-0.5\" x-text=\"docVersions.document?.code + ' — ' + docVersions.document?.title\"></p>\r\n              </div>\r\n              <button @click=\"docVersions.open=false\" class=\"text-gray-400 hover:text-gray-700 text-xl\">✖</button>\r\n            </div>\r\n            <div class=\"p-4 space-y-4\">\r\n              <!-- Upload new version -->\r\n              <div class=\"border border-dashed border-brand-300 rounded-xl p-4 bg-brand-50\">\r\n                <h4 class=\"font-semibold text-brand-700 mb-3 text-sm\">⬆️ رفع إصدار جديد</h4>\r\n                <div class=\"grid grid-cols-2 gap-3 mb-3\">\r\n                  <div>\r\n                    <label class=\"block text-xs text-gray-600 mb-1\">رقم الإصدار</label>\r\n                    <input type=\"text\" x-model=\"docVersions.uploadVersion\" placeholder=\"مثال: 1.1\"\r\n                      class=\"w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-400 outline-none\">\r\n                  </div>\r\n                  <div>\r\n                    <label class=\"block text-xs text-gray-600 mb-1\">ملف الوثيقة (PDF / Word / Excel)</label>\r\n                    <input type=\"file\" accept=\".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png\"\r\n                      @change=\"docVersions.file = $event.target.files[0]\"\r\n                      class=\"w-full text-sm text-gray-600 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-brand-100 file:text-brand-700 hover:file:bg-brand-200 cursor-pointer\">\r\n                  </div>\r\n                </div>\r\n                <div class=\"mb-3\">\r\n                  <label class=\"block text-xs text-gray-600 mb-1\">ملاحظة التغيير (اختياري)</label>\r\n                  <input type=\"text\" x-model=\"docVersions.uploadChangeLog\" placeholder=\"ما الذي تغيّر في هذا الإصدار؟\"\r\n                    class=\"w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-400 outline-none\">\r\n                </div>\r\n                <div class=\"flex items-center gap-3\">\r\n                  <button @click=\"doUploadDoc()\" :disabled=\"docVersions.uploading || !docVersions.file\"\r\n                    class=\"px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2\">\r\n                    <span x-show=\"docVersions.uploading\" class=\"animate-spin\">⏳</span>\r\n                    <span x-show=\"!docVersions.uploading\">⬆️</span>\r\n                    رفع الملف\r\n                  </button>\r\n                  <span x-show=\"docVersions.uploadMsg\" x-text=\"docVersions.uploadMsg\"\r\n                    class=\"text-xs\" :class=\"docVersions.uploadError ? 'text-red-600' : 'text-green-600'\"></span>\r\n                </div>\r\n              </div>\r\n\r\n              <!-- Versions list -->\r\n              <div>\r\n                <h4 class=\"font-semibold text-gray-700 mb-2 text-sm\">📁 الإصدارات المرفوعة</h4>\r\n                <div x-show=\"!docVersions.versions?.length\" class=\"text-center text-gray-400 py-6 text-sm\">لا توجد إصدارات مرفوعة بعد</div>\r\n                <table x-show=\"docVersions.versions?.length\" class=\"w-full text-sm\">\r\n                  <thead class=\"bg-gray-50\">\r\n                    <tr>\r\n                      <th class=\"px-3 py-2 text-right\">الإصدار</th>\r\n                      <th class=\"px-3 py-2 text-right\">تاريخ الرفع</th>\r\n                      <th class=\"px-3 py-2 text-right\">الحجم</th>\r\n                      <th class=\"px-3 py-2 text-right\">ملاحظة التغيير</th>\r\n                      <th class=\"px-3 py-2 text-right\">تنزيل</th>\r\n                    </tr>\r\n                  </thead>\r\n                  <tbody>\r\n                    <template x-for=\"v in docVersions.versions\" :key=\"v.id\">\r\n                      <tr class=\"border-t hover:bg-gray-50\">\r\n                        <td class=\"px-3 py-2 font-mono font-bold text-brand-700\" x-text=\"v.version\"></td>\r\n                        <td class=\"px-3 py-2 text-gray-600\" x-text=\"new Date(v.uploadedAt).toLocaleDateString('ar-SA')\"></td>\r\n                        <td class=\"px-3 py-2 text-gray-500\" x-text=\"v.fileSize ? (Math.round(v.fileSize/1024) + ' KB') : '—'\"></td>\r\n                        <td class=\"px-3 py-2 text-gray-700\" x-text=\"v.changeLog || '—'\"></td>\r\n                        <td class=\"px-3 py-2\">\r\n                          <button @click=\"downloadDocVersion(docVersions.document?.id, v)\"\r\n                            class=\"text-brand-600 hover:text-brand-800 text-xs font-medium hover:underline\">\r\n                            ⬇️ تنزيل\r\n                          </button>\r\n                        </td>\r\n                      </tr>\r\n                    </template>\r\n                  </tbody>\r\n                </table>\r\n                <p class=\"text-xs text-gray-400 mt-3 text-center\">الإصدار الحالي: <span class=\"font-bold\" x-text=\"docVersions.document?.currentVersion\"></span></p>\r\n              </div>\r\n            </div>\r\n          </div>\r\n        </div>\r\n\r\n        ";

  function mount() {
    const host = document.getElementById('document-versions-modal-host');
    if (!host) return false;
    if (host.dataset.templateMounted === '1') return true;
    host.innerHTML = html;
    host.dataset.templateMounted = '1';
    if (window.Alpine?.initTree) window.Alpine.initTree(host);
    return true;
  }

  function scheduleMount() {
    if (mount()) return;

    let attempts = 0;
    const retry = () => {
      attempts += 1;
      if (mount()) return;
      if (attempts < 50) window.setTimeout(retry, 100);
    };
    window.setTimeout(retry, 0);

    const root = document.body || document.documentElement;
    if (root && window.MutationObserver) {
      const observer = new MutationObserver(() => {
        if (mount()) observer.disconnect();
      });
      observer.observe(root, { childList: true, subtree: true });
      window.setTimeout(() => observer.disconnect(), 20000);
    }
  }

  window.addEventListener('qms:templates:mount', scheduleMount);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleMount, { once: true });
  } else {
    scheduleMount();
  }

})();

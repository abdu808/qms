// Auto-extracted from index.html. Keep behavior in app.js/modules; this file only mounts markup.
(() => {
  const html = "<!-- DATA HEALTH REPORT (Batch 13) -->\r\n          <div x-show=\"page==='dataHealth'\" x-cloak>\r\n            <template x-if=\"dataHealth\">\r\n              <div>\r\n                <div class=\"bg-gradient-to-l from-teal-600 to-cyan-600 text-white rounded-xl p-6 mb-4 shadow\">\r\n                  <div class=\"flex justify-between items-center flex-wrap gap-4\">\r\n                    <div>\r\n                      <div class=\"text-sm opacity-90\">🩺 تقرير صحة البيانات المؤسسية</div>\r\n                      <h2 class=\"text-2xl font-bold mt-1\">Data Health Report</h2>\r\n                      <div class=\"text-xs opacity-80 mt-1\">\r\n                        حُدِّث: <span x-text=\"new Date(dataHealth.generatedAt).toLocaleString('ar-SA')\"></span>\r\n                      </div>\r\n                    </div>\r\n                    <div class=\"text-center\">\r\n                      <div class=\"text-5xl font-bold\" x-text=\"dataHealth.summary.healthScore\"></div>\r\n                      <div class=\"text-xs opacity-90\">درجة الصحة / 100</div>\r\n                    </div>\r\n                  </div>\r\n                  <div class=\"mt-3 grid grid-cols-4 gap-2 text-center text-sm\">\r\n                    <div class=\"bg-white/10 rounded p-2\">\r\n                      <div class=\"font-bold text-xl\" x-text=\"dataHealth.summary.totalFindings\"></div>\r\n                      <div class=\"text-xs opacity-90\">إجمالي</div>\r\n                    </div>\r\n                    <div class=\"bg-red-500/40 rounded p-2\">\r\n                      <div class=\"font-bold text-xl\" x-text=\"dataHealth.summary.critical\"></div>\r\n                      <div class=\"text-xs opacity-90\">حرج</div>\r\n                    </div>\r\n                    <div class=\"bg-orange-500/40 rounded p-2\">\r\n                      <div class=\"font-bold text-xl\" x-text=\"dataHealth.summary.high\"></div>\r\n                      <div class=\"text-xs opacity-90\">مرتفع</div>\r\n                    </div>\r\n                    <div class=\"bg-amber-500/40 rounded p-2\">\r\n                      <div class=\"font-bold text-xl\" x-text=\"dataHealth.summary.warning\"></div>\r\n                      <div class=\"text-xs opacity-90\">تحذير</div>\r\n                    </div>\r\n                  </div>\r\n                </div>\r\n\r\n                <div class=\"space-y-2\">\r\n                  <template x-for=\"c in dataHealth.checks\" :key=\"c.key\">\r\n                    <div class=\"bg-white rounded-xl border overflow-hidden\">\r\n                      <button @click=\"toggleHealthCheck(c.key)\"\r\n                        class=\"w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition\">\r\n                        <div class=\"flex items-center gap-3\">\r\n                          <span :class=\"'w-3 h-3 rounded-full ' + healthSeverityClass(c.severity)\"></span>\r\n                          <div class=\"text-right\">\r\n                            <div class=\"font-bold text-gray-800\" x-text=\"c.title\"></div>\r\n                            <div class=\"text-xs text-gray-500\" x-text=\"c.hint\"></div>\r\n                          </div>\r\n                        </div>\r\n                        <div class=\"flex items-center gap-3\">\r\n                          <span :class=\"'text-xs px-2 py-0.5 rounded text-white ' + healthSeverityClass(c.severity)\"\r\n                                x-text=\"healthSeverityLabel(c.severity)\"></span>\r\n                          <span class=\"text-2xl font-bold\" :class=\"c.count ? 'text-red-600' : 'text-green-600'\"\r\n                                x-text=\"c.count\"></span>\r\n                          <span class=\"text-gray-400\" x-text=\"dataHealthExpanded[c.key] ? '▼' : '◀'\"></span>\r\n                        </div>\r\n                      </button>\r\n                      <div x-show=\"dataHealthExpanded[c.key] && c.items?.length\" x-cloak\r\n                        class=\"border-t bg-gray-50 px-4 py-3\">\r\n                        <template x-if=\"!c.items.length\">\r\n                          <div class=\"text-sm text-green-600\">✓ لا توجد ملاحظات</div>\r\n                        </template>\r\n                        <ul class=\"space-y-1.5 text-sm\">\r\n                          <template x-for=\"it in c.items.slice(0,20)\" :key=\"it.id\">\r\n                            <li class=\"flex items-start justify-between gap-2 py-1 border-b border-gray-200 last:border-0\">\r\n                              <div class=\"flex-1 min-w-0\">\r\n                                <span class=\"font-mono text-xs text-gray-500\" x-text=\"it.code || ''\"></span>\r\n                                <span class=\"font-medium text-gray-800 mr-1\" x-text=\"it.title || ''\"></span>\r\n                                <div class=\"text-xs text-gray-600\" x-text=\"it.reason\"></div>\r\n                              </div>\r\n                              <button @click=\"goToLink(it.actionUrl)\"\r\n                                      class=\"text-xs text-blue-600 hover:underline whitespace-nowrap\">فتح ←</button>\r\n                            </li>\r\n                          </template>\r\n                        </ul>\r\n                        <template x-if=\"c.items.length > 20\">\r\n                          <div class=\"text-xs text-gray-500 mt-2\">وأكثر: <span x-text=\"c.items.length - 20\"></span> عنصر…</div>\r\n                        </template>\r\n                      </div>\r\n                    </div>\r\n                  </template>\r\n                </div>\r\n              </div>\r\n            </template>\r\n          </div>\r\n\r\n          ";

  function mount() {
    const host = document.getElementById('data-health-report-page-host');
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

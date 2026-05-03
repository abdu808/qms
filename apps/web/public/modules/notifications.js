/**
 * modules/notifications.js — صندوق الإشعارات (P-06 · ISO 7.4)
 * يُدمج في app() عبر ...window.QmsNotifications
 */
(function () {
  'use strict';

  window.QmsNotifications = {
    // ─── State ─────────────────────────────────────────────────
    notifications: [],
    notifUnread: 0,
    notifOpen: false,
    _notifTimer: null,

    // ─── Methods ───────────────────────────────────────────────
    async loadNotifications() {
      try {
        const r = await this.api('GET', '/notifications?limit=30');
        this.notifications = r.items || [];
        this.notifUnread = r.unreadCount || 0;
      } catch { /* silent */ }
    },
    async toggleNotifications() {
      this.notifOpen = !this.notifOpen;
      if (this.notifOpen) await this.loadNotifications();
    },
    async openNotification(n) {
      if (!n.readAt) {
        try { await this.api('POST', `/notifications/${n.id}/read`); } catch {}
        n.readAt = new Date().toISOString();
        this.notifUnread = Math.max(0, this.notifUnread - 1);
      }
      this.notifOpen = false;
      // انتقال للرابط الداخلي إن وُجد (مثال: /#/ncr?id=... → nav للصفحة)
      if (n.link) {
        if (typeof this.goToLink === 'function') this.goToLink(n.link);
        else {
          const m = n.link.match(/#\/([\w-]+)/);
          if (m) this.goto(m[1]);
        }
      }
    },
    async readAllNotifications() {
      try {
        await this.api('POST', '/notifications/read-all');
        this.notifications.forEach(n => { if (!n.readAt) n.readAt = new Date().toISOString(); });
        this.notifUnread = 0;
      } catch (e) { alert(e.message || 'فشل القراءة'); }
    },
    startNotifPolling() {
      if (this._notifTimer) clearInterval(this._notifTimer);
      this.loadNotifications();
      this._notifTimer = setInterval(() => this.loadNotifications(), 5 * 60 * 1000); // كل 5 دقائق
    },
  };
})();

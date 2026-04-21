/**
 * modules/training.js — سجلات التدريب (الحضور والفعالية)
 * يُدمج في app() عبر ...window.QmsTraining
 */
(function () {
  'use strict';
  window.QmsTraining = {
    // ─── State ───────────────────────────────────────────────────────────
    trainingRecords: {
      open: false, training: null, records: [], stats: null, users: [],
      newRecord: { userId: '', attended: false, score: null, effective: '', certUrl: '' },
    },

    // ─── Methods ─────────────────────────────────────────────────────────
    async openTrainingRecords(training) {
      try {
        const [recs, users] = await Promise.all([
          this.api('GET', `/training/${training.id}/records`),
          this.api('GET', '/users?limit=200'),
        ]);
        this.trainingRecords = {
          open: true,
          training,
          records: recs.records || [],
          stats: recs.stats,
          users: users.items || [],
          newRecord: { userId: '', attended: false, score: null, effective: '', certUrl: '' },
        };
      } catch (e) { alert(e.message || 'فشل تحميل السجلات'); }
    },
    async saveTrainingRecord(rec) {
      const payload = {
        userId: rec.userId || rec.user?.id,
        attended: !!rec.attended,
        score: rec.score === '' ? null : rec.score,
        effective: rec.effective === '' ? null : rec.effective,
        certUrl: rec.certUrl || null,
      };
      if (!payload.userId) return alert('اختر الموظف أولاً');
      try {
        await this.api('POST', `/training/${this.trainingRecords.training.id}/records`, payload);
        // Refresh
        const recs = await this.api('GET', `/training/${this.trainingRecords.training.id}/records`);
        this.trainingRecords.records = recs.records;
        this.trainingRecords.stats = recs.stats;
        this.trainingRecords.newRecord = { userId: '', attended: false, score: null, effective: '', certUrl: '' };
      } catch (e) { alert(e.message || 'فشل الحفظ'); }
    },
    async deleteTrainingRecord(userId) {
      if (!confirm('حذف هذا السجل؟')) return;
      try {
        await this.api('DELETE', `/training/${this.trainingRecords.training.id}/records/${userId}`);
        const recs = await this.api('GET', `/training/${this.trainingRecords.training.id}/records`);
        this.trainingRecords.records = recs.records;
        this.trainingRecords.stats = recs.stats;
      } catch (e) { alert(e.message || 'فشل الحذف'); }
    },
  };
})();

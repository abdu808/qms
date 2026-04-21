/**
 * modules/signatures.js — التوقيع الرقمي + State-machine cache (Batch 10)
 * يُدمج في app() عبر ...window.QmsSignatures
 */
(function () {
  'use strict';

  window.QmsSignatures = {
    // ─── State ─────────────────────────────────────────────────
    stateMachines: null,
    sigModal: null,  // { entityType, entityId, purpose, label, onDone, dataUrl, busy }

    // ─── State-machine cache ────────────────────────────────────
    async loadStateMachines() {
      if (this.stateMachines) return this.stateMachines;
      try {
        const r = await this.api('GET', '/state-machines');
        this.stateMachines = r.machines || {};
      } catch { this.stateMachines = {}; }
      return this.stateMachines;
    },
    /**
     * إرجاع قائمة الحالات المسموح الانتقال إليها.
     * يُستدعى من قوائم الحالة في النماذج بدلاً من hard-coding كل الخيارات.
     *   allowedNextFor('ncr', 'IN_PROGRESS') → ['VERIFICATION','ACTION_PLANNED','CANCELLED']
     */
    allowedNextFor(entity, from) {
      const m = this.stateMachines?.[entity];
      if (!m) return null;   // غير معروف → اسمح بكل شيء (fallback)
      return m[from] || [];
    },

    /**
     * فلترة خيارات dropdown الحالة ديناميكياً من state-machine.
     * في وضع "create" يعيد كل الخيارات؛ في وضع "edit" يعيد فقط
     * [الحالة الحالية + الحالات المسموح الانتقال إليها].
     */
    statusOptionsFor(f) {
      const all = f.options || [];
      if (f.key !== 'status') return all;
      if (this.modal?.mode !== 'edit') return all;
      const entityMap = { ncr: 'ncr', complaints: 'complaint', audits: 'audit', managementReview: 'management-review' };
      const entity = entityMap[this.page];
      if (!entity) return all;
      const currentStatus = this.modal.data?.status;
      const allowed = this.allowedNextFor(entity, currentStatus);
      if (!allowed) return all;  // لا machine → fallback كل الخيارات
      const keep = new Set([currentStatus, ...allowed]);
      return all.filter(o => keep.has(o.v));
    },

    // ─── Digital signature capture ──────────────────────────────
    openSignatureModal({ entityType, entityId, purpose, label, onDone }) {
      this.sigModal = {
        entityType, entityId, purpose, label,
        onDone: onDone || (() => {}),
        dataUrl: '',
        busy: false,
      };
      // canvas setup يتم في next tick بعد ظهور الـ DOM
      this.$nextTick(() => this._initSigCanvas());
    },
    closeSignatureModal() { this.sigModal = null; },

    _initSigCanvas() {
      const cvs = document.getElementById('sigCanvas');
      if (!cvs) return;
      const ctx = cvs.getContext('2d');
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap  = 'round';
      ctx.strokeStyle = '#1f2937';
      let drawing = false, last = null;
      const getPos = (e) => {
        const rect = cvs.getBoundingClientRect();
        const t = e.touches?.[0];
        const x = (t ? t.clientX : e.clientX) - rect.left;
        const y = (t ? t.clientY : e.clientY) - rect.top;
        return { x: x * cvs.width / rect.width, y: y * cvs.height / rect.height };
      };
      const down = (e) => { e.preventDefault(); drawing = true; last = getPos(e); };
      const move = (e) => {
        if (!drawing) return;
        e.preventDefault();
        const p = getPos(e);
        ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        last = p;
      };
      const up = () => { drawing = false; };
      cvs.addEventListener('mousedown', down); cvs.addEventListener('mousemove', move); cvs.addEventListener('mouseup', up);
      cvs.addEventListener('touchstart', down); cvs.addEventListener('touchmove', move); cvs.addEventListener('touchend', up);
      cvs._ctx = ctx;
    },
    clearSignature() {
      const cvs = document.getElementById('sigCanvas');
      if (cvs) cvs._ctx?.clearRect(0, 0, cvs.width, cvs.height);
      if (this.sigModal) this.sigModal.dataUrl = '';
    },
    async confirmSignature() {
      if (!this.sigModal) return;
      const cvs = document.getElementById('sigCanvas');
      if (!cvs) return;
      const dataUrl = cvs.toDataURL('image/png');
      // اكتشاف التوقيع الفارغ: قارن مع لوحة فارغة
      const empty = document.createElement('canvas');
      empty.width = cvs.width; empty.height = cvs.height;
      if (dataUrl === empty.toDataURL('image/png')) {
        alert('⚠️ الرجاء رسم التوقيع أولاً');
        return;
      }
      this.sigModal.busy = true;
      try {
        await this.api('POST', '/signatures', {
          entityType:    this.sigModal.entityType,
          entityId:      this.sigModal.entityId,
          purpose:       this.sigModal.purpose,
          signatureData: dataUrl,
        });
        const cb = this.sigModal.onDone;
        this.closeSignatureModal();
        this.toast?.('✅ تم تسجيل التوقيع الرقمي', 'success');
        await cb?.();
      } catch (e) {
        alert(e.message || 'فشل حفظ التوقيع');
      } finally {
        if (this.sigModal) this.sigModal.busy = false;
      }
    },
  };
})();

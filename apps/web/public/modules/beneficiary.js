/**
 * modules/beneficiary.js — تقييم أولوية المستفيدين (Batch 15)
 * يُدمج في app() عبر ...window.QmsBeneficiary
 */
(function () {
  'use strict';

  window.QmsBeneficiary = {
    // ─── State ─────────────────────────────────────────────────
    benAssess: {
      open: false, id: null, fullName: '', code: '',
      needsAssessment: '', monthlyIncome: '', familySize: '',
      vulnerabilityFlags: [], useComputedScore: true, priorityScore: 3,
      preview: null, // { score, recommendation, breakdown, incomePerCapita, povertyLine }
      flagsMeta: [],
    },

    // ─── Open Assessment ────────────────────────────────────────
    async openBeneficiaryAssess(item) {
      try {
        const [meta, preview] = await Promise.all([
          this.api('GET', '/beneficiaries/meta'),
          this.api('GET', `/beneficiaries/${item.id}/assessment`),
        ]);
        const flags = (item.vulnerabilityFlags || '').split(/[,،]/).map(s=>s.trim()).filter(Boolean);
        this.benAssess = {
          open: true, id: item.id, fullName: item.fullName, code: item.code,
          category: item.category,
          needsAssessment: item.needsAssessment || '',
          monthlyIncome:   item.monthlyIncome ?? '',
          familySize:      item.familySize ?? '',
          vulnerabilityFlags: flags,
          useComputedScore: true,
          priorityScore: preview?.computed?.score || item.priorityScore || 3,
          preview: preview?.computed || null,
          flagsMeta: meta?.vulnerabilityFlags || [],
          currentReviewDue: preview?.current?.reviewDueDate || null,
          needsReview: preview?.current?.needsReview || false,
        };
      } catch (e) { alert(e.message || 'فشل فتح التقييم'); }
    },

    // ─── Preview (local computation matching server logic) ──────
    async previewBeneficiaryAssess() {
      try {
        const a = this.benAssess;
        a.vulnerabilityFlags = a.vulnerabilityFlags || [];
        const base = { ORPHAN:5, DISABLED:5, WIDOW:4, POOR_FAMILY:3, ELDERLY:4, STUDENT:2, OTHER:2 };
        const pl = 1100;
        const fam = Math.max(1, Number(a.familySize) || 1);
        const income = Number(a.monthlyIncome);
        let econ = 0;
        if (Number.isFinite(income) && income >= 0) {
          const pc = income / fam;
          if (pc < 0.3*pl) econ = 3;
          else if (pc < 0.6*pl) econ = 2;
          else if (pc < pl) econ = 1;
        }
        const vuln = Math.min(3, (a.vulnerabilityFlags.length || 0) * 0.75);
        let famPts = 0;
        if (fam >= 8) famPts = 1.5;
        else if (fam >= 5) famPts = 1;
        else if (fam >= 3) famPts = 0.5;
        const raw = (base[a.category] || 2) + econ*0.6 + vuln*0.5 + famPts*0.4;
        const score = Math.max(1, Math.min(5, Math.round(raw)));
        const rec = score>=4 ? 'APPROVE' : score===3 ? 'CONDITIONAL' : score===2 ? 'REVIEW' : 'REJECT';
        this.benAssess.preview = { score, recommendation: rec,
          breakdown: { economicPoints: econ, vulnPoints: vuln, familyPoints: famPts, rawTotal: +raw.toFixed(2) } };
        if (a.useComputedScore) a.priorityScore = score;
      } catch {}
    },

    toggleVulnFlag(key) {
      const arr = this.benAssess.vulnerabilityFlags || [];
      const i = arr.indexOf(key);
      if (i >= 0) arr.splice(i, 1); else arr.push(key);
      this.benAssess.vulnerabilityFlags = arr;
      this.previewBeneficiaryAssess();
    },

    async submitBeneficiaryAssess() {
      const a = this.benAssess;
      if (!a.needsAssessment?.trim() || a.needsAssessment.trim().length < 10) {
        return alert('وصف الاحتياجات إلزامي (10 أحرف فأكثر)');
      }
      try {
        const payload = {
          needsAssessment: a.needsAssessment,
          monthlyIncome: a.monthlyIncome === '' ? undefined : Number(a.monthlyIncome),
          familySize:    a.familySize    === '' ? undefined : Number(a.familySize),
          vulnerabilityFlags: (a.vulnerabilityFlags || []).join(','),
          useComputedScore: !!a.useComputedScore,
          priorityScore: a.priorityScore,
        };
        const r = await this.api('POST', `/beneficiaries/${a.id}/assess`, payload);
        this.benAssess.open = false;
        alert(`✅ تم حفظ التقييم\nدرجة الأولوية: ${r.item.priorityScore}/5\nالتوصية: ${r.recommendation}`);
        await this.loadList();
      } catch (e) { alert(e.message || 'فشل حفظ التقييم'); }
    },

    recommendationLabel(r) {
      return { APPROVE: '✅ اعتماد', CONDITIONAL: '⚠️ اعتماد مشروط',
               REVIEW: '🔄 مراجعة إضافية', REJECT: '⛔ رفض' }[r] || r;
    },

    async loadBeneficiariesDueReview() {
      try {
        const r = await this.api('GET', '/beneficiaries/due-review');
        return r;
      } catch { return null; }
    },
  };
})();

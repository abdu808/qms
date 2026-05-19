/**
 * modules/ack-documents.js — إطار الإقرارات الموحَّد (Ack Documents / AckToken)
 * يُدمج في app() عبر ...window.QmsAckDocuments
 */
(function () {
  'use strict';

  window.QmsAckDocuments = {
    // ─── State ─────────────────────────────────────────────────
    myAcks: { pending: [], completed: [], pendingCount: 0 },
    ackOpsSummary: null,
    ackOpsSummaryLoading: false,
    ackMatrix: null, // { docs, users, rows, overall }
    ackMatrixLoading: false,
    ackMatrixError: null,
    ackReadModal: null,          // الوثيقة المفتوحة للقراءة
    ackScrolledToEnd: false,
    ackConfirmRead: false,
    ackSubmitting: false,
    linksModal: null,    // { doc, items, newForm, busy }

    // ─── إطار الإقرارات ─────────────────────────────────────────
    async loadMyAcks() {
      try {
        this.myAcks = await this.api('GET', '/ack-documents/me/pending');
      } catch { this.myAcks = { pending: [], completed: [], pendingCount: 0 }; }
    },

    async loadAckOpsSummary() {
      if (!this.canEdit?.('ack-documents')) return;
      this.ackOpsSummaryLoading = true;
      try {
        this.ackOpsSummary = await this.api('GET', '/ack-documents/dashboard-summary');
      } catch (e) {
        console.warn('[ack-dashboard-summary]', e?.message || e);
        this.ackOpsSummary = null;
      } finally {
        this.ackOpsSummaryLoading = false;
      }
    },

    ackCoverageTone(value) {
      const n = Number(value || 0);
      if (n >= 90) return 'text-emerald-700 bg-emerald-50 border-emerald-100';
      if (n >= 70) return 'text-amber-700 bg-amber-50 border-amber-100';
      return 'text-rose-700 bg-rose-50 border-rose-100';
    },

    openAckRead(doc) {
      this.ackReadModal = doc;
      this.ackScrolledToEnd = false;
      this.ackConfirmRead = false;
    },

    closeAckRead() {
      this.ackReadModal = null;
      this.ackScrolledToEnd = false;
      this.ackConfirmRead = false;
    },

    onAckScroll(ev) {
      const el = ev.target;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
        this.ackScrolledToEnd = true;
      }
    },

    async submitAcknowledge() {
      if (!this.ackReadModal || !this.ackScrolledToEnd || !this.ackConfirmRead) return;
      this.ackSubmitting = true;
      try {
        await this.api('POST', `/ack-documents/${this.ackReadModal.id}/acknowledge`, {});
        this.toast?.('✅ تم تسجيل إقرارك بالاطّلاع والالتزام');
        this.closeAckRead();
        await this.loadMyAcks();
      } catch (e) {
        alert(e.message || 'فشل تسجيل الإقرار');
      } finally { this.ackSubmitting = false; }
    },

    async activateAckDoc(item) {
      if (!confirm(`تفعيل الوثيقة "${item.title}"؟\nسيُطلب الإقرار من كل المستهدفين.`)) return;
      try {
        await this.api('POST', `/ack-documents/${item.id}/activate`, {});
        this.toast?.('✅ تم تفعيل الوثيقة');
        await this.loadList?.();
      } catch (e) { alert(e.message || 'فشل التفعيل'); }
    },

    async deactivateAckDoc(item) {
      if (!confirm(`إلغاء تفعيل الوثيقة "${item.title}"؟`)) return;
      try {
        await this.api('POST', `/ack-documents/${item.id}/deactivate`, {});
        this.toast?.('تم إلغاء التفعيل');
        await this.loadList?.();
      } catch (e) { alert(e.message || 'فشل الإلغاء'); }
    },

    // ─── إدارة روابط الإقرار (AckToken) ────────────────────────
    async openLinksModal(doc) {
      this.linksModal = {
        doc,
        items: [],
        loading: true,
        busy: false,
        tab: 'internal',   // internal | external | bulk
        form: { userId: '', externalType: 'EXTERNAL', externalName: '', externalContact: '', sentVia: 'WHATSAPP', expiresAt: '' },
        bulkIds: new Set(),
        bulkSearch: '',
      };
      try {
        const r = await this.api('GET', `/ack-documents/${doc.id}/tokens`);
        this.linksModal.items = r.items || [];
      } catch (e) { console.warn(e); }
      // تحميل المستخدمين النشطين لعرضهم في القوائم
      if (!this.relationOptions.users || !this.relationOptions.users.length) {
        try {
          const u = await this.api('GET', '/users?limit=500&active=true');
          this.relationOptions.users = (u.items || []).filter(x => x.active !== false);
        } catch { this.relationOptions.users = []; }
      }
      this.linksModal.loading = false;
    },

    closeLinksModal() { this.linksModal = null; },

    ackPublicUrl(tok) {
      const base = window.location.origin;
      return `${base}/ack/${tok.token}`;
    },

    async copyAckLink(tok) {
      const url = this.ackPublicUrl(tok);
      try {
        await navigator.clipboard.writeText(url);
        this.toast?.('📋 نُسخ الرابط — الصقه في واتساب أو رسالة', 'success');
      } catch {
        prompt('انسخ الرابط:', url);
      }
    },

    ackWhatsAppUrl(tok) {
      const url = this.ackPublicUrl(tok);
      const who = tok.user?.name || tok.externalName || '';
      const docTitle = this.linksModal?.doc?.title || '';
      const msg = `السلام عليكم ${who}،\nنرجو الاطّلاع على: ${docTitle}\nوالإقرار عبر الرابط التالي:\n${url}\n\nشكراً لتعاونكم.`;
      const phone = (tok.user?.phone || tok.externalContact || '').replace(/\D/g, '');
      return phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    },

    async sendViaWhatsApp(tok) {
      window.open(this.ackWhatsAppUrl(tok), '_blank');
      try {
        await this.api('POST', `/ack-documents/${this.linksModal.doc.id}/tokens/${tok.id}/mark-sent`, { sentVia: 'WHATSAPP' });
        tok.sentAt = new Date().toISOString();
        tok.sentVia = 'WHATSAPP';
      } catch {}
    },

    async createAckLink() {
      if (!this.linksModal) return;
      const m = this.linksModal;
      m.busy = true;
      const f = m.form;
      const body = { sentVia: f.sentVia || null };
      if (f.expiresAt) body.expiresAt = f.expiresAt;
      if (m.tab === 'internal') {
        if (!f.userId) { alert('اختر الموظف/العضو'); m.busy = false; return; }
        body.userId = f.userId;
      } else {
        if (!f.externalName) { alert('أدخل اسم الشخص'); m.busy = false; return; }
        body.externalType = f.externalType;
        body.externalName = f.externalName;
        body.externalContact = f.externalContact;
      }
      try {
        const r = await this.api('POST', `/ack-documents/${m.doc.id}/tokens`, body);
        if (r.token) m.items.unshift(r.token);
        m.form = { ...f, userId: '', externalName: '', externalContact: '' };
        this.toast?.('✅ تم إنشاء رابط الإقرار');
      } catch (e) { alert(e.message || 'فشل الإنشاء'); }
      finally { m.busy = false; }
    },

    async createBulkLinks() {
      if (!this.linksModal) return;
      const m = this.linksModal;
      const ids = Array.from(m.bulkIds);
      if (!ids.length) { alert('اختر موظفاً واحداً على الأقل'); return; }
      m.busy = true;
      try {
        const r = await this.api('POST', `/ack-documents/${m.doc.id}/tokens`, {
          userIds: ids,
          sentVia: m.form.sentVia || 'WHATSAPP',
          expiresAt: m.form.expiresAt || undefined,
        });
        const fresh = await this.api('GET', `/ack-documents/${m.doc.id}/tokens`);
        m.items = fresh.items || [];
        m.bulkIds = new Set();
        this.toast?.(`✅ تم إنشاء ${r.count} رابط`);
      } catch (e) { alert(e.message || 'فشل الإنشاء'); }
      finally { m.busy = false; }
    },

    toggleBulkId(id) {
      const s = this.linksModal.bulkIds;
      if (s.has(id)) s.delete(id); else s.add(id);
    },

    // ── Arabic text normalization (يطابق backend utils/normalize.js) ──
    // تحويل كل variants لحرف موحّد حتى بحث "احمد" يطابق "أحمد".
    normalizeArabic(s) {
      if (!s) return '';
      return String(s)
        .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // tashkeel + tatweel
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ئ/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/ة/g, 'ه')
        .toLowerCase()
        .trim();
    },
    // هل النص يُطابق الاستعلام بعد normalize للطرفين؟
    arabicMatches(text, query) {
      if (!query) return true;
      const qn = this.normalizeArabic(query);
      if (!qn) return true;
      return this.normalizeArabic(text).includes(qn);
    },

    bulkFilteredUsers() {
      if (!this.linksModal) return [];
      const q = (this.linksModal.bulkSearch || '').trim();
      const users = this.relationOptions.users || [];
      if (!q) return users;
      // استخدم normalize ليتطابق "احمد" مع "أحمد" و "علي" مع "علي" بعد tashkeel
      return users.filter(u => this.arabicMatches(u.name, q) || this.arabicMatches(u.email, q));
    },

    async deleteAckLink(tok) {
      if (!confirm('حذف الرابط؟')) return;
      try {
        await this.api('DELETE', `/ack-documents/${this.linksModal.doc.id}/tokens/${tok.id}`);
        this.linksModal.items = this.linksModal.items.filter(x => x.id !== tok.id);
      } catch (e) { alert(e.message); }
    },

    async quickAckLink(userId, docId) {
      // إنشاء سريع لرابط إقرار ثم فتح modal لنسخه/إرساله
      try {
        const r = await this.api('POST', `/ack-documents/${docId}/tokens`, { userId, sentVia: 'WHATSAPP' });
        const doc = (this.ackMatrix?.docs || []).find(d => d.id === docId);
        if (doc) {
          await this.openLinksModal(doc);
          this.toast?.('✅ تم إنشاء الرابط — استخدم 📋 لنسخه أو 📱 لإرساله عبر واتساب');
        }
      } catch (e) { alert(e.message || 'فشل إنشاء الرابط'); }
    },

    async loadAckMatrix() {
      this.ackMatrixLoading = true;
      this.ackMatrixError = null;
      try {
        this.ackMatrix = await this.api('GET', '/ack-documents/matrix');
      } catch (e) {
        console.warn('matrix failed', e);
        this.ackMatrix = null;
        this.ackMatrixError = e?.message || 'تعذّر تحميل المصفوفة — تأكّد من تشغيل prisma db push وإنشاء جداول الإقرارات.';
      } finally {
        this.ackMatrixLoading = false;
      }
    },

    // اسم مختصر للفئة (لعرض لطيف)
    ackCategoryLabel(cat) {
      const map = {
        QUALITY_POLICY:'سياسة الجودة', CODE_OF_ETHICS:'ميثاق أخلاقي',
        CONFLICT_OF_INTEREST:'تضارب مصالح', CONFIDENTIALITY:'سرية',
        DATA_PROTECTION:'حماية بيانات', SAFEGUARDING:'حماية (فئات ضعيفة)',
        ANTI_HARASSMENT:'مكافحة تحرش', ANTI_CORRUPTION:'مكافحة فساد',
        WHISTLEBLOWER:'إبلاغ عن مخالفات', WORK_REGULATIONS:'لائحة عمل',
        HEALTH_SAFETY:'صحة وسلامة', IT_USAGE:'استخدام تقنية',
        SOCIAL_MEDIA:'تواصل اجتماعي', BOARD_CHARTER:'ميثاق مجلس',
        BYLAWS:'نظام أساسي', BENEFICIARY_RIGHTS:'حقوق مستفيد',
        BENEFICIARY_CONSENT:'موافقة مستفيد', SUPPLIER_CODE:'ميثاق مورّدين',
        DONOR_PRIVACY:'خصوصية متبرّع', VOLUNTEER_AGREEMENT:'اتفاقية تطوّع',
        OTHER:'أخرى',
      };
      return map[cat] || cat;
    },
    ackAudienceLabel(aud) {
      const map = {
        EMPLOYEE:'موظفون', VOLUNTEER:'متطوعون', BOARD_MEMBER:'مجلس إدارة',
        GENERAL_ASSEMBLY:'جمعية عمومية', BENEFICIARY:'مستفيدون',
        SUPPLIER:'مورّدون', DONOR:'متبرّعون', AUDITOR:'مدقّقون', ALL:'الجميع',
      };
      return map[aud] || aud;
    },
  };
})();

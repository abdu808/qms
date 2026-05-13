/**
 * modules/swot.js ? extracted from app.js.
 * Merged into app() via ...window.QmsSwot.
 */
(function () {
  'use strict';

  window.QmsSwot = {
    async swotCreateRisk(item) {
      if (!item?.id) return;
      try {
        const risk = await this.api('POST', `/swot/${item.id}/create-risk`, {});
        this.toast?.(`تم تحويل بند SWOT إلى سجل مخاطر/فرصة ${risk?.code || ''}`, 'success');
        await this.loadList?.(this.pageNo || 1);
      } catch (e) {
        this.toast?.(e.message || 'تعذر تحويل بند SWOT إلى خطر/فرصة', 'error');
      }
    },
    async swotCreateFollowUp(item) {
      if (!item?.id) return;
      try {
        const task = await this.api('POST', `/swot/${item.id}/create-follow-up`, {});
        this.toast?.(`تم إنشاء مهمة متابعة ${task?.code || ''}`, 'success');
        await this.loadList?.(this.pageNo || 1);
      } catch (e) {
        this.toast?.(e.message || 'تعذر إنشاء مهمة متابعة من SWOT', 'error');
      }
    },

    setSwotViewMode(mode) {
      this.swotViewMode = mode === 'list' ? 'list' : 'matrix';
      this._setUserLocalJson('swot_view_mode', this.swotViewMode);
    },
    swotMeta(type) {
      const key = String(type || '').toUpperCase();
      return {
        STRENGTH: {
          title: 'نقاط القوة',
          subtitle: 'ما نملكه داخلياً ويساعدنا',
          icon: '💪',
          box: 'border-emerald-200 bg-emerald-50/70',
          head: 'text-emerald-800',
          pill: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          action: 'استثمرها وحافظ عليها',
        },
        WEAKNESS: {
          title: 'نقاط الضعف',
          subtitle: 'ما يعيقنا داخلياً ويحتاج تحسين',
          icon: '🧩',
          box: 'border-amber-200 bg-amber-50/75',
          head: 'text-amber-900',
          pill: 'bg-amber-100 text-amber-900 border-amber-200',
          action: 'حوّلها لخطة معالجة',
        },
        OPPORTUNITY: {
          title: 'الفرص',
          subtitle: 'شيء خارجي يمكن أن نستفيد منه',
          icon: '🌱',
          box: 'border-sky-200 bg-sky-50/75',
          head: 'text-sky-900',
          pill: 'bg-sky-100 text-sky-900 border-sky-200',
          action: 'حوّلها لمبادرة أو فرصة',
        },
        THREAT: {
          title: 'التهديدات',
          subtitle: 'شيء خارجي قد يضر الجمعية',
          icon: '⚠️',
          box: 'border-rose-200 bg-rose-50/75',
          head: 'text-rose-900',
          pill: 'bg-rose-100 text-rose-900 border-rose-200',
          action: 'حوّلها لخطر ومتابعة',
        },
      }[key] || {
        title: key || 'غير مصنف',
        subtitle: 'بند سياق يحتاج تصنيف',
        icon: '•',
        box: 'border-slate-200 bg-slate-50',
        head: 'text-slate-800',
        pill: 'bg-slate-100 text-slate-700 border-slate-200',
        action: 'راجع التصنيف',
      };
    },
    swotQuadrants() {
      const list = Array.isArray(this.items) ? this.items : [];
      return ['STRENGTH', 'WEAKNESS', 'OPPORTUNITY', 'THREAT'].map(type => ({
        type,
        meta: this.swotMeta(type),
        items: list.filter(item => String(item.type || '').toUpperCase() === type),
      }));
    },
    swotImpactClass(impact) {
      const text = String(impact || '');
      if (text.includes('عال') || text.includes('مرتفع')) return 'bg-red-50 text-red-700 border-red-100';
      if (text.includes('متوسط')) return 'bg-amber-50 text-amber-700 border-amber-100';
      if (text.includes('منخفض')) return 'bg-slate-50 text-slate-600 border-slate-200';
      return 'bg-slate-50 text-slate-500 border-slate-200';
    },
    swotNeedsRisk(item) {
      const type = String(item?.type || '').toUpperCase();
      return !item?.deletedAt && !item?.relatedRiskId && ['WEAKNESS', 'THREAT', 'OPPORTUNITY'].includes(type);
    },
    swotTranslationState(item) {
      const type = String(item?.type || '').toUpperCase();
      const links = [];
      if (item?.relatedGoalId || item?.relatedGoal) links.push('مرتبط بهدف');
      if (item?.relatedRiskId || item?.relatedRisk) links.push(type === 'OPPORTUNITY' ? 'مرتبط بفرصة' : 'مرتبط بخطر');
      if (item?.strategy) links.push('له توجه تعامل');
      if (item?.ownerUserId || item?.ownerUser) links.push('له مالك');

      if (['WEAKNESS', 'THREAT'].includes(type) && !(item?.relatedRiskId || item?.relatedRisk)) {
        return {
          level: 'needs-action',
          label: 'يحتاج تحويل لخطر/خطة معالجة',
          className: 'bg-red-50 text-red-700 border-red-100',
          links,
        };
      }
      if (type === 'OPPORTUNITY' && !(item?.relatedGoalId || item?.relatedGoal || item?.relatedRiskId || item?.relatedRisk)) {
        return {
          level: 'needs-action',
          label: 'يحتاج ربط بهدف أو فرصة',
          className: 'bg-amber-50 text-amber-700 border-amber-100',
          links,
        };
      }
      if (type === 'STRENGTH' && !(item?.relatedGoalId || item?.relatedGoal || item?.strategy)) {
        return {
          level: 'monitor',
          label: 'قوة للرصد فقط',
          className: 'bg-slate-50 text-slate-600 border-slate-200',
          links,
        };
      }
      return {
        level: 'ok',
        label: links.includes('مرتبط بهدف') || links.some(x => x.includes('خطر') || x.includes('فرصة')) ? 'مترجم عملياً' : 'مترجم كتوجه متابعة',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        links,
      };
    },
    swotTranslationSummary() {
      const list = Array.isArray(this.items) ? this.items : [];
      const states = list.map(item => this.swotTranslationState(item));
      return {
        total: list.length,
        ok: states.filter(s => s.level === 'ok').length,
        monitor: states.filter(s => s.level === 'monitor').length,
        needsAction: states.filter(s => s.level === 'needs-action').length,
      };
    },

  };
})();

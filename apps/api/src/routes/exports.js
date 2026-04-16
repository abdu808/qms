import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import ExcelJS from 'exceljs';

const router = Router();

const fmt = (v, type) => {
  if (v === null || v === undefined) return '';
  if (type === 'date') return v ? new Date(v).toLocaleDateString('ar-SA') : '';
  if (type === 'bool') return v ? 'نعم' : 'لا';
  return String(v);
};

const CONFIGS = {
  objectives: {
    label: 'الأهداف والمؤشرات',
    fetch: () => prisma.objective.findMany({ orderBy: { createdAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'الهدف' },
      { key: 'kpi', label: 'مؤشر الأداء' },
      { key: 'target', label: 'المستهدف' },
      { key: 'unit', label: 'الوحدة' },
      { key: 'currentValue', label: 'القيمة الحالية' },
      { key: 'progress', label: 'الإنجاز %' },
      { key: 'startDate', label: 'تاريخ البداية', type: 'date' },
      { key: 'dueDate', label: 'تاريخ الاستحقاق', type: 'date' },
      { key: 'status', label: 'الحالة' },
    ],
  },
  risks: {
    label: 'المخاطر والفرص',
    fetch: () => prisma.risk.findMany({ orderBy: { createdAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'type', label: 'النوع' },
      { key: 'title', label: 'العنوان' },
      { key: 'source', label: 'المصدر' },
      { key: 'probability', label: 'الاحتمالية' },
      { key: 'impact', label: 'الأثر' },
      { key: 'score', label: 'الدرجة' },
      { key: 'level', label: 'المستوى' },
      { key: 'status', label: 'الحالة' },
      { key: 'treatment', label: 'خطة المعالجة' },
    ],
  },
  complaints: {
    label: 'الشكاوى',
    fetch: () => prisma.complaint.findMany({ orderBy: { receivedAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'subject', label: 'الموضوع' },
      { key: 'source', label: 'الجهة' },
      { key: 'channel', label: 'القناة' },
      { key: 'complainantName', label: 'المشتكي' },
      { key: 'complainantPhone', label: 'الجوال' },
      { key: 'severity', label: 'الأهمية' },
      { key: 'status', label: 'الحالة' },
      { key: 'rootCause', label: 'السبب الجذري' },
      { key: 'resolution', label: 'الحل' },
      { key: 'receivedAt', label: 'تاريخ الاستقبال', type: 'date' },
    ],
  },
  ncr: {
    label: 'عدم المطابقة',
    fetch: () => prisma.nCR.findMany({ orderBy: { createdAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'العنوان' },
      { key: 'description', label: 'الوصف' },
      { key: 'severity', label: 'الأهمية' },
      { key: 'rootCause', label: 'السبب الجذري' },
      { key: 'correction', label: 'التصحيح الفوري' },
      { key: 'correctiveAction', label: 'الإجراء التصحيحي' },
      { key: 'status', label: 'الحالة' },
      { key: 'dueDate', label: 'تاريخ الاستحقاق', type: 'date' },
    ],
  },
  suppliers: {
    label: 'الموردون',
    fetch: () => prisma.supplier.findMany({ orderBy: { createdAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'name', label: 'الاسم' },
      { key: 'type', label: 'النوع' },
      { key: 'crNumber', label: 'السجل التجاري' },
      { key: 'vatNumber', label: 'الرقم الضريبي' },
      { key: 'contactPerson', label: 'الشخص المسؤول' },
      { key: 'phone', label: 'الجوال' },
      { key: 'city', label: 'المدينة' },
      { key: 'overallRating', label: 'التقييم الإجمالي' },
      { key: 'status', label: 'الحالة' },
    ],
  },
  beneficiaries: {
    label: 'المستفيدون',
    fetch: () => prisma.beneficiary.findMany({ orderBy: { createdAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'fullName', label: 'الاسم الكامل' },
      { key: 'nationalId', label: 'الهوية الوطنية' },
      { key: 'category', label: 'الفئة' },
      { key: 'gender', label: 'الجنس' },
      { key: 'birthDate', label: 'تاريخ الميلاد', type: 'date' },
      { key: 'phone', label: 'الجوال' },
      { key: 'city', label: 'المدينة' },
      { key: 'district', label: 'الحي' },
      { key: 'familySize', label: 'أفراد الأسرة' },
      { key: 'monthlyIncome', label: 'الدخل الشهري' },
      { key: 'status', label: 'الحالة' },
    ],
  },
  training: {
    label: 'التدريب',
    fetch: () => prisma.training.findMany({ orderBy: { date: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'الدورة' },
      { key: 'description', label: 'الوصف' },
      { key: 'trainer', label: 'المدرب' },
      { key: 'date', label: 'التاريخ', type: 'date' },
      { key: 'duration', label: 'المدة (ساعات)' },
      { key: 'location', label: 'المكان' },
      { key: 'category', label: 'الفئة' },
    ],
  },
  audits: {
    label: 'التدقيق الداخلي',
    fetch: () => prisma.audit.findMany({ orderBy: { createdAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'العنوان' },
      { key: 'type', label: 'النوع' },
      { key: 'scope', label: 'النطاق' },
      { key: 'plannedDate', label: 'التاريخ المخطط', type: 'date' },
      { key: 'actualDate', label: 'التاريخ الفعلي', type: 'date' },
      { key: 'findings', label: 'النتائج' },
      { key: 'strengths', label: 'نقاط القوة' },
      { key: 'weaknesses', label: 'نقاط التحسين' },
      { key: 'status', label: 'الحالة' },
    ],
  },
  donations: {
    label: 'التبرعات',
    fetch: () => prisma.donation.findMany({ orderBy: { receivedAt: 'desc' } }),
    cols: [
      { key: 'code', label: 'الرمز' },
      { key: 'donorName', label: 'المتبرع' },
      { key: 'donorPhone', label: 'الجوال' },
      { key: 'type', label: 'النوع' },
      { key: 'itemName', label: 'الصنف' },
      { key: 'quantity', label: 'الكمية' },
      { key: 'unit', label: 'الوحدة' },
      { key: 'amount', label: 'المبلغ' },
      { key: 'status', label: 'الحالة' },
      { key: 'receivedAt', label: 'تاريخ الاستلام', type: 'date' },
    ],
  },
};

router.get('/:model', asyncHandler(async (req, res) => {
  const cfg = CONFIGS[req.params.model];
  if (!cfg) return res.status(404).json({ ok: false, error: { message: 'نموذج التصدير غير موجود' } });

  const items = await cfg.fetch();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'QMS - جمعية البر بصبيا';
  wb.created = new Date();

  const ws = wb.addWorksheet(cfg.label, { views: [{ rightToLeft: true }] });
  ws.columns = cfg.cols.map(c => ({ header: c.label, key: c.key, width: 26 }));

  const headerRow = ws.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E8B57' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
  });

  items.forEach((item, idx) => {
    const rowData = {};
    cfg.cols.forEach(c => { rowData[c.key] = fmt(item[c.key], c.type); });
    const row = ws.addRow(rowData);
    if (idx % 2 === 0) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9F4' } };
      });
    }
    row.eachCell(cell => {
      cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });
    row.height = 18;
  });

  const filename = encodeURIComponent(`${cfg.label}-${new Date().toISOString().split('T')[0]}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
  await wb.xlsx.write(res);
  res.end();
}));

export default router;

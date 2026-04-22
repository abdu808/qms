/**
 * extractors.mjs — استخراج النص من DOCX / PPTX / XLSX / TXT / MD
 */
import mammoth from 'mammoth';
import officeparser from 'officeparser';
import ExcelJS from 'exceljs';
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * يستخرج النص من ملف حسب الامتداد
 * @returns { text, kind, meta? }
 */
export const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.xlsx', '.xls', '.txt', '.md'];

export async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf')  return await extractPdf(filePath);
  if (ext === '.docx') return await extractDocx(filePath);
  if (ext === '.pptx') return await extractPptx(filePath);
  if (ext === '.xlsx' || ext === '.xls') return await extractXlsx(filePath);
  if (ext === '.txt' || ext === '.md') return await extractText_(filePath);
  throw new Error(`امتداد غير مدعوم: ${ext} — المدعوم: ${SUPPORTED_EXTENSIONS.join(', ')}`);
}

async function extractPdf(filePath) {
  const text = await new Promise((resolve, reject) => {
    officeparser.parseOffice(filePath, (data, err) => {
      if (err) return reject(err);
      resolve(data || '');
    });
  });
  return { text: String(text || '').trim(), kind: 'pdf' };
}

async function extractDocx(filePath) {
  const buf = await readFile(filePath);
  const result = await mammoth.extractRawText({ buffer: buf });
  return {
    text: (result.value || '').trim(),
    kind: 'docx',
    warnings: result.messages?.length || 0,
  };
}

async function extractPptx(filePath) {
  const text = await new Promise((resolve, reject) => {
    officeparser.parseOffice(filePath, (data, err) => {
      if (err) return reject(err);
      resolve(data || '');
    });
  });
  return {
    text: String(text || '').trim(),
    kind: 'pptx',
  };
}

async function extractText_(filePath) {
  const buf = await readFile(filePath, 'utf8');
  return { text: buf.trim(), kind: 'text' };
}

/**
 * استخراج XLSX — يحوِّل كل ورقة إلى جدول Markdown
 * هذا أنسب من CSV لأن AI يفهم بنية الجدول بشكل أدق.
 * يتجاهل الصفوف الفارغة تماماً ويُقصِّر الأوراق الضخمة.
 */
async function extractXlsx(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheetTexts = [];
  const meta = { sheets: [] };

  for (const ws of wb.worksheets) {
    const sheetName = ws.name;
    // استخراج الصفوف كمصفوفات — قيمة كل خلية
    const rows = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const arr = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        let v = cell.value;
        // exceljs يعيد أنواعاً معقدة أحياناً (formula, richText, hyperlink)
        if (v && typeof v === 'object') {
          if (v.text) v = v.text;                          // richText
          else if (v.result !== undefined) v = v.result;   // formula
          else if (v.hyperlink) v = v.text || v.hyperlink; // hyperlink
          else if (v instanceof Date) { /* يبقى Date */ }
          else v = JSON.stringify(v);
        }
        arr.push(v == null ? '' : v);
      });
      rows.push(arr);
    });
    const nonEmpty = rows.filter(r => r.some(c => c !== '' && c !== null && c !== undefined));
    if (nonEmpty.length === 0) continue;

    // حساب أكبر عدد أعمدة فعلي
    const maxCols = Math.max(...nonEmpty.map(r => r.length));
    // قص الأعمدة الفارغة من اليمين
    const trimmed = nonEmpty.map(r => {
      const arr = r.slice(0, maxCols);
      while (arr.length > 0 && (arr[arr.length - 1] === '' || arr[arr.length - 1] == null)) arr.pop();
      return arr;
    }).filter(r => r.length > 0);

    if (trimmed.length === 0) continue;

    // حدّ أقصى 200 صف لكل ورقة (لتجنب ملفات ضخمة)
    const MAX_ROWS = 200;
    const capped = trimmed.slice(0, MAX_ROWS);
    const truncated = trimmed.length > MAX_ROWS;

    // بناء جدول Markdown
    const tableCols = Math.max(...capped.map(r => r.length));
    const fmt = (v) => {
      if (v === null || v === undefined) return '';
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
    };
    const lines = [];
    lines.push(`### ورقة: ${sheetName}`);
    lines.push('');
    // الصف الأول كـ header (حتى لو لم يكن header حقيقي — AI سيفهم)
    const header = capped[0];
    lines.push('| ' + header.map(fmt).join(' | ') + ' |');
    lines.push('| ' + Array(tableCols).fill('---').join(' | ') + ' |');
    for (let i = 1; i < capped.length; i++) {
      const r = capped[i];
      // تعبئة الخلايا الناقصة
      const padded = [...r];
      while (padded.length < header.length) padded.push('');
      lines.push('| ' + padded.map(fmt).join(' | ') + ' |');
    }
    if (truncated) {
      lines.push(`\n_[تم قص الجدول — الأصل ${trimmed.length} صف، عُرض ${MAX_ROWS}]_`);
    }

    sheetTexts.push(lines.join('\n'));
    meta.sheets.push({ name: sheetName, rows: trimmed.length, cols: tableCols, truncated });
  }

  const text = sheetTexts.join('\n\n---\n\n');
  return {
    text,
    kind: 'xlsx',
    meta,
  };
}

/** يُقصّر النص إلى حدّ معقول لـ AI (tokens) */
export function truncateForAi(text, maxChars = 30_000) {
  if (!text) return '';
  if (text.length <= maxChars) return text;
  const head = text.slice(0, Math.floor(maxChars * 0.8));
  const tail = text.slice(-Math.floor(maxChars * 0.2));
  return head + '\n\n...[تم اختصار الجزء الأوسط]...\n\n' + tail;
}

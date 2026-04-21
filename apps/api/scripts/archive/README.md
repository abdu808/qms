# Archive — سكربتات لمرة واحدة

هذه السكربتات **لا تُشغَّل تلقائياً** من `startup.sh` ولا من أي workflow.
تُحفظ هنا للرجوع التاريخي فقط.

## المحتوى

| الملف | الغرض |
|---|---|
| `apply-classification.mjs` | تطبيق تصنيف الـ KPI على بيانات قديمة |
| `eval-system.mjs` | تقييم حالة النظام (ad-hoc) |
| `import-data.mjs` | استيراد بيانات أولية من Excel |
| `import-operational.mjs` | استيراد الخطة التشغيلية |
| `iso-check.mjs` | فحص التزام ISO 9001 |
| `kpi-classification-proposal.mjs` | اقتراح تصنيف المؤشرات |
| `read-excel.mjs` | قارئ Excel محلي (يشير لمسارات Windows) |
| `seed-ack-documents.mjs` | تعبئة وثائق الإقرار |
| `seed-iso-requirements.mjs` | تعبئة متطلبات ISO |
| `setup-all.mjs` / `setup-all2.mjs` | إعداد شامل لمرة واحدة (نسختان) |
| `upload-iso-docs.mjs` | رفع وثائق ISO |

## لا تشغّلها على الإنتاج
معظمها يحتوي بيانات ثابتة أو يشير لمسارات محلية.
إذا احتجت أحدها: راجعه، حدّثه، ثم شغّله محلياً.

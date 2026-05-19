-- Seed the three mandatory core acknowledgment documents.
-- Idempotent data migration: updates existing rows by code and never creates duplicates.

WITH ref AS (
  SELECT id, code, title, "currentVersion", "approvalReference", "publicationUrl"
  FROM "Document"
  WHERE "deletedAt" IS NULL
    AND status IN ('PUBLISHED', 'APPROVED')
    AND title ILIKE '%سياسة الجودة%'
  ORDER BY CASE WHEN status = 'PUBLISHED' THEN 2 ELSE 1 END DESC, "updatedAt" DESC
  LIMIT 1
)
INSERT INTO "AckDocument" (
  id, code, title, category, audience, version, content, commitments,
  "referenceTitle", "referenceUrl", "referenceNote",
  mandatory, "renewFrequency", "effectiveDate", "reviewDate", active,
  "approvedBy", "approvedAt", "createdAt", "updatedAt"
)
VALUES (
  'ack_core_qp_001_2026',
  'ACK-CORE-QP-001-2026',
  'إقرار الاطلاع على سياسة الجودة',
  'QUALITY_POLICY',
  ARRAY['EMPLOYEE'::"AckAudience", 'VOLUNTEER'::"AckAudience", 'BOARD_MEMBER'::"AckAudience"],
  '1.0',
  $$# إقرار الاطلاع على سياسة الجودة

أقر بأنني اطلعت على سياسة الجودة المعتمدة في جمعية البر بمحافظة صبيا، وفهمت أن الجودة ليست ملفاً منفصلاً عن العمل اليومي، بل هي طريقة تنفيذ الخدمة ومتابعتها وتحسينها.

أفهم أن التزامي يشمل:
- أداء عملي وفق الإجراءات المعتمدة.
- المحافظة على دقة البيانات والسجلات.
- التعاون في إدخال المؤشرات والرد على المتابعات في وقتها.
- الإبلاغ عن فرص التحسين أو المشكلات التي تؤثر على جودة الخدمة.

يعد هذا الإقرار جزءاً من سجلات التوعية والالتزام بمتطلبات نظام إدارة الجودة ISO 9001:2015.$$,
  $$ألتزم بتطبيق سياسة الجودة ضمن نطاق عملي.
ألتزم بالمشاركة في التحسين المستمر وعدم تعطيل سجلات المتابعة.
أبلغ عن أي مشكلة أو فرصة تحسين تؤثر على جودة الخدمة.$$,
  COALESCE((SELECT code || ' - ' || title FROM ref), 'إقرار الاطلاع على سياسة الجودة'),
  COALESCE((SELECT "publicationUrl" FROM ref), (SELECT '/api/documents/' || id FROM ref)),
  COALESCE(
    (SELECT 'وثيقة رسمية معتمدة في سجل الوثائق.' ||
      COALESCE(E'\nالإصدار: ' || "currentVersion", '') ||
      COALESCE(E'\nمرجع الاعتماد: ' || "approvalReference", '')
     FROM ref),
    'لم يتم العثور على وثيقة رسمية منشورة مطابقة؛ يراجع مدير الجودة الرابط بعد اعتماد الوثيقة.'
  ),
  true, 'ON_CHANGE', NOW(), NOW() + INTERVAL '1 year', true,
  'الإدارة التنفيذية / مدير الجودة', NOW(), NOW(), NOW()
)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  audience = EXCLUDED.audience,
  version = EXCLUDED.version,
  content = EXCLUDED.content,
  commitments = EXCLUDED.commitments,
  "referenceTitle" = EXCLUDED."referenceTitle",
  "referenceUrl" = EXCLUDED."referenceUrl",
  "referenceNote" = EXCLUDED."referenceNote",
  mandatory = EXCLUDED.mandatory,
  "renewFrequency" = EXCLUDED."renewFrequency",
  "effectiveDate" = EXCLUDED."effectiveDate",
  "reviewDate" = EXCLUDED."reviewDate",
  active = EXCLUDED.active,
  "approvedBy" = EXCLUDED."approvedBy",
  "approvedAt" = EXCLUDED."approvedAt",
  "updatedAt" = NOW(),
  "deletedAt" = NULL;

WITH ref AS (
  SELECT id, code, title, "currentVersion", "approvalReference", "publicationUrl"
  FROM "Document"
  WHERE "deletedAt" IS NULL
    AND status IN ('PUBLISHED', 'APPROVED')
    AND (
      title ILIKE '%الميثاق%'
      OR title ILIKE '%الأخلاقي%'
      OR title ILIKE '%السلوك%'
    )
  ORDER BY CASE WHEN status = 'PUBLISHED' THEN 2 ELSE 1 END DESC, "updatedAt" DESC
  LIMIT 1
)
INSERT INTO "AckDocument" (
  id, code, title, category, audience, version, content, commitments,
  "referenceTitle", "referenceUrl", "referenceNote",
  mandatory, "renewFrequency", "effectiveDate", "reviewDate", active,
  "approvedBy", "approvedAt", "createdAt", "updatedAt"
)
VALUES (
  'ack_core_eth_001_2026',
  'ACK-CORE-ETH-001-2026',
  'إقرار الميثاق الأخلاقي والسلوك المهني',
  'CODE_OF_ETHICS',
  ARRAY['EMPLOYEE'::"AckAudience", 'VOLUNTEER'::"AckAudience", 'BOARD_MEMBER'::"AckAudience"],
  '1.0',
  $$# إقرار الميثاق الأخلاقي والسلوك المهني

أقر بأنني اطلعت على الميثاق الأخلاقي والسلوك المهني المعتمد في الجمعية، وفهمت أن التعامل مع المستفيدين والداعمين والزملاء يجب أن يقوم على الاحترام، النزاهة، العدالة، وحفظ الكرامة.

أفهم أن الالتزام يشمل:
- عدم استغلال الصلاحيات أو المعلومات.
- تجنب تضارب المصالح والإفصاح عنه عند وجوده.
- احترام سرية العمل وخصوصية الأطراف ذات العلاقة.
- التعامل المهني مع الشكاوى والملاحظات.

يعد هذا الإقرار مرجعاً لسلوك الموظف أو المتطوع داخل الجمعية وفي أي تمثيل رسمي لها.$$,
  $$ألتزم بالسلوك المهني والاحترام في جميع تعاملاتي.
أفصح عن أي تضارب مصالح محتمل.
لا أستخدم صلاحياتي أو معلومات الجمعية لأغراض شخصية.$$,
  COALESCE((SELECT code || ' - ' || title FROM ref), 'إقرار الميثاق الأخلاقي والسلوك المهني'),
  COALESCE((SELECT "publicationUrl" FROM ref), (SELECT '/api/documents/' || id FROM ref)),
  COALESCE(
    (SELECT 'وثيقة رسمية معتمدة في سجل الوثائق.' ||
      COALESCE(E'\nالإصدار: ' || "currentVersion", '') ||
      COALESCE(E'\nمرجع الاعتماد: ' || "approvalReference", '')
     FROM ref),
    'لم يتم العثور على وثيقة رسمية منشورة مطابقة؛ يراجع مدير الجودة الرابط بعد اعتماد الوثيقة.'
  ),
  true, 'ON_CHANGE', NOW(), NOW() + INTERVAL '1 year', true,
  'الإدارة التنفيذية / مدير الجودة', NOW(), NOW(), NOW()
)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  audience = EXCLUDED.audience,
  version = EXCLUDED.version,
  content = EXCLUDED.content,
  commitments = EXCLUDED.commitments,
  "referenceTitle" = EXCLUDED."referenceTitle",
  "referenceUrl" = EXCLUDED."referenceUrl",
  "referenceNote" = EXCLUDED."referenceNote",
  mandatory = EXCLUDED.mandatory,
  "renewFrequency" = EXCLUDED."renewFrequency",
  "effectiveDate" = EXCLUDED."effectiveDate",
  "reviewDate" = EXCLUDED."reviewDate",
  active = EXCLUDED.active,
  "approvedBy" = EXCLUDED."approvedBy",
  "approvedAt" = EXCLUDED."approvedAt",
  "updatedAt" = NOW(),
  "deletedAt" = NULL;

WITH ref AS (
  SELECT id, code, title, "currentVersion", "approvalReference", "publicationUrl"
  FROM "Document"
  WHERE "deletedAt" IS NULL
    AND status IN ('PUBLISHED', 'APPROVED')
    AND (
      title ILIKE '%حماية البيانات%'
      OR title ILIKE '%السرية%'
      OR title ILIKE '%المستفيدين%'
      OR title ILIKE '%خصوصية%'
    )
  ORDER BY CASE WHEN status = 'PUBLISHED' THEN 2 ELSE 1 END DESC, "updatedAt" DESC
  LIMIT 1
)
INSERT INTO "AckDocument" (
  id, code, title, category, audience, version, content, commitments,
  "referenceTitle", "referenceUrl", "referenceNote",
  mandatory, "renewFrequency", "effectiveDate", "reviewDate", active,
  "approvedBy", "approvedAt", "createdAt", "updatedAt"
)
VALUES (
  'ack_core_dp_001_2026',
  'ACK-CORE-DP-001-2026',
  'إقرار السرية وحماية بيانات المستفيدين',
  'DATA_PROTECTION',
  ARRAY['EMPLOYEE'::"AckAudience", 'VOLUNTEER'::"AckAudience", 'BOARD_MEMBER'::"AckAudience"],
  '1.0',
  $$# إقرار السرية وحماية بيانات المستفيدين

أقر بأنني اطلعت على متطلبات السرية وحماية بيانات المستفيدين، وفهمت أن بيانات المستفيدين والكافلين والداعمين لا يجوز استخدامها أو مشاركتها إلا لغرض العمل المصرح به.

أفهم أن الالتزام يشمل:
- عدم مشاركة بيانات المستفيدين خارج القنوات المعتمدة.
- عدم تصوير أو نسخ أو نقل أي بيانات دون تصريح.
- استخدام الأنظمة الرسمية فقط في حفظ البيانات ومتابعتها.
- الإبلاغ فوراً عن أي فقدان أو تسريب أو اشتباه في وصول غير مصرح.

هذا الإقرار يدعم متطلبات الخصوصية، وحماية المستفيد، وضبط المعلومات الموثقة ضمن نظام إدارة الجودة.$$,
  $$ألتزم بسرية بيانات المستفيدين والداعمين والكافلين.
لا أشارك أي بيانات إلا عبر القنوات المعتمدة ولغرض العمل.
أبلغ فوراً عن أي حادثة أو اشتباه يتعلق بسرية البيانات.$$,
  COALESCE((SELECT code || ' - ' || title FROM ref), 'إقرار السرية وحماية بيانات المستفيدين'),
  COALESCE((SELECT "publicationUrl" FROM ref), (SELECT '/api/documents/' || id FROM ref)),
  COALESCE(
    (SELECT 'وثيقة رسمية معتمدة في سجل الوثائق.' ||
      COALESCE(E'\nالإصدار: ' || "currentVersion", '') ||
      COALESCE(E'\nمرجع الاعتماد: ' || "approvalReference", '')
     FROM ref),
    'لم يتم العثور على وثيقة رسمية منشورة مطابقة؛ يراجع مدير الجودة الرابط بعد اعتماد الوثيقة.'
  ),
  true, 'ON_CHANGE', NOW(), NOW() + INTERVAL '1 year', true,
  'الإدارة التنفيذية / مدير الجودة', NOW(), NOW(), NOW()
)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  audience = EXCLUDED.audience,
  version = EXCLUDED.version,
  content = EXCLUDED.content,
  commitments = EXCLUDED.commitments,
  "referenceTitle" = EXCLUDED."referenceTitle",
  "referenceUrl" = EXCLUDED."referenceUrl",
  "referenceNote" = EXCLUDED."referenceNote",
  mandatory = EXCLUDED.mandatory,
  "renewFrequency" = EXCLUDED."renewFrequency",
  "effectiveDate" = EXCLUDED."effectiveDate",
  "reviewDate" = EXCLUDED."reviewDate",
  active = EXCLUDED.active,
  "approvedBy" = EXCLUDED."approvedBy",
  "approvedAt" = EXCLUDED."approvedAt",
  "updatedAt" = NOW(),
  "deletedAt" = NULL;

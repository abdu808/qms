-- ─────────────────────────────────────────────────────────────────────
-- NotificationTemplate — قوالب الرسائل القابلة للتعديل
-- ─────────────────────────────────────────────────────────────────────
-- يسمح للمشرف بتعديل نص الرسائل بدون تعديل الكود.
-- كل قالب مرتبط بحدث (eventKey) ثابت يستدعيه الكود عند الحاجة.

CREATE TABLE "NotificationTemplate" (
    "id"          TEXT          NOT NULL,
    "eventKey"    TEXT          NOT NULL,
    "name"        TEXT          NOT NULL,
    "description" TEXT,
    "subject"     TEXT          NOT NULL,
    "body"        TEXT          NOT NULL,
    "channels"    TEXT          NOT NULL DEFAULT 'IN_APP,WHATSAPP',
    "enabled"     BOOLEAN       NOT NULL DEFAULT true,
    "category"    TEXT          NOT NULL DEFAULT 'KPI',
    "variables"   TEXT,
    "updatedById" TEXT,
    "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationTemplate_eventKey_key" ON "NotificationTemplate"("eventKey");
CREATE INDEX "NotificationTemplate_category_idx" ON "NotificationTemplate"("category");
CREATE INDEX "NotificationTemplate_enabled_idx" ON "NotificationTemplate"("enabled");

ALTER TABLE "NotificationTemplate"
    ADD CONSTRAINT "NotificationTemplate_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────
-- Seed: 5 قوالب أولية للـ KPI Follow-Up
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO "NotificationTemplate" ("id", "eventKey", "name", "description", "subject", "body", "channels", "enabled", "category", "variables", "updatedAt")
VALUES
(
    'tpl_kpi_first_notice',
    'KPI_FIRST_NOTICE',
    'تنبيه أول لإدخال قراءة مؤشر',
    'يُرسَل للموظف بعد 5 أيام من تاريخ الاستحقاق إن لم يُدخل القراءة',
    '⏰ تذكير: مؤشر متأخر — {{indicatorCode}}',
    'السلام عليكم {{employeeName}}،

لم يتم إدخال قراءة المؤشر التالي:
• المؤشر: {{indicatorName}} ({{indicatorCode}})
• الفترة: {{month}}/{{year}}
• تاريخ الاستحقاق: {{dueDate}}
• التأخير الحالي: {{daysLate}} يوم

يرجى استكمال الإدخال في أقرب وقت من خلال نظام الجودة:
{{link}}

— نظام إدارة الجودة',
    'IN_APP,WHATSAPP',
    true,
    'KPI',
    '{{employeeName}},{{indicatorCode}},{{indicatorName}},{{month}},{{year}},{{daysLate}},{{dueDate}},{{link}},{{followUpCode}}',
    CURRENT_TIMESTAMP
),
(
    'tpl_kpi_escalate_l1',
    'KPI_ESCALATED_L1',
    'تصعيد لمدير القسم',
    'يُرسَل لمدير القسم بعد 10 أيام من تأخر إدخال مؤشر تابع لقسمه',
    '🚨 تصعيد: مؤشر متأخر يخص قسمكم — {{indicatorCode}}',
    'السلام عليكم {{managerName}}،

نُحيطكم علماً بتأخر إدخال قراءة مؤشر يخص قسمكم:
• المؤشر: {{indicatorName}} ({{indicatorCode}})
• القسم: {{departmentName}}
• الفترة: {{month}}/{{year}}
• مدخل البيانات المسؤول: {{employeeName}}
• التأخير الحالي: {{daysLate}} يوم

يرجى متابعة الموظف المسؤول لاستكمال الإدخال، أو الدخول للنظام لاتخاذ الإجراء المناسب:
{{link}}

— نظام إدارة الجودة',
    'IN_APP,WHATSAPP,EMAIL',
    true,
    'KPI',
    '{{managerName}},{{employeeName}},{{indicatorCode}},{{indicatorName}},{{departmentName}},{{month}},{{year}},{{daysLate}},{{dueDate}},{{link}},{{followUpCode}}',
    CURRENT_TIMESTAMP
),
(
    'tpl_kpi_escalate_l2',
    'KPI_ESCALATED_L2',
    'تصعيد حرج للإدارة العليا',
    'يُرسَل لمدير الجودة والمدير التنفيذي بعد 15 يوم من تأخر إدخال مؤشر',
    '🆘 تصعيد حرج: تأخّر مزمن في إدخال مؤشر — {{indicatorCode}}',
    'تنبيه عاجل،

تأخّر إدخال قراءة المؤشر التالي تجاوز الحد المسموح وتطلّب تدخلاً تنفيذياً:
• المؤشر: {{indicatorName}} ({{indicatorCode}})
• القسم: {{departmentName}}
• الفترة: {{month}}/{{year}}
• مدخل البيانات: {{employeeName}}
• التأخير: {{daysLate}} يوم
• مستوى التصعيد: 2 (حرج)

تم إعلام مدير القسم سابقاً دون استجابة. يُرجى التدخل لاتخاذ القرار المناسب:
{{link}}

— نظام إدارة الجودة',
    'IN_APP,WHATSAPP,EMAIL',
    true,
    'KPI',
    '{{employeeName}},{{indicatorCode}},{{indicatorName}},{{departmentName}},{{month}},{{year}},{{daysLate}},{{dueDate}},{{link}},{{followUpCode}}',
    CURRENT_TIMESTAMP
),
(
    'tpl_kpi_pre_deadline',
    'KPI_PRE_DEADLINE',
    'تذكير قبل موعد الإغلاق الشهري',
    'يُرسَل للموظف قبل 3 أيام من نهاية الشهر إن لم يُدخل القراءة بعد',
    '🔔 تذكير قبل الإغلاق الشهري — {{month}}/{{year}}',
    'السلام عليكم {{employeeName}}،

يقترب موعد إغلاق الإدخالات الشهرية لشهر {{month}}/{{year}}.
لم يتم إدخال قراءة المؤشر التالي:
• {{indicatorName}} ({{indicatorCode}})

يرجى استكمال الإدخال قبل {{dueDate}} لتجنّب التصعيد:
{{link}}

— نظام إدارة الجودة',
    'IN_APP,WHATSAPP',
    true,
    'KPI',
    '{{employeeName}},{{indicatorCode}},{{indicatorName}},{{month}},{{year}},{{dueDate}},{{link}}',
    CURRENT_TIMESTAMP
),
(
    'tpl_kpi_resolved',
    'KPI_RESOLVED',
    'إشعار حلّ المتابعة',
    'يُرسَل عند إدخال القراءة وحلّ المتابعة (للموظف ومدير القسم)',
    '✅ تم استكمال إدخال المؤشر — {{indicatorCode}}',
    'تحية طيبة،

تم استكمال إدخال قراءة المؤشر التالي وإغلاق المتابعة:
• المؤشر: {{indicatorName}} ({{indicatorCode}})
• الفترة: {{month}}/{{year}}
• الكود: {{followUpCode}}

شكراً لتعاونكم.

— نظام إدارة الجودة',
    'IN_APP',
    true,
    'KPI',
    '{{employeeName}},{{indicatorCode}},{{indicatorName}},{{month}},{{year}},{{followUpCode}}',
    CURRENT_TIMESTAMP
);

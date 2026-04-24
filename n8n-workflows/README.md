# n8n Workflows — نظام إدارة الجودة

## الـ Workflows المتاحة

| الملف | الوظيفة | الجدول |
|-------|---------|--------|
| `01-daily-alerts.json` | تنبيهات يومية (NCR/CAPA/شكاوى/مخاطر) | كل يوم 7:00 ص |
| `02-weekly-report.json` | تقرير أسبوعي بالذكاء الاصطناعي | كل أحد 8:00 ص |
| `03-department-messaging.json` | رسائل مخصصة لمديري الأقسام | كل أحد 9:00 ص |

---

## طريقة الاستيراد في n8n

1. افتح n8n → **Workflows** → **Import from File**
2. اختر الملف JSON المطلوب
3. أضف **Credentials** المطلوبة (SMTP / Telegram)
4. عيِّن **Environment Variables** (انظر أدناه)
5. فعِّل الـ Workflow

---

## Environment Variables المطلوبة

أضف هذه المتغيرات في n8n → **Settings** → **Variables**:

```
QMS_API_URL          = https://quality.aqiltech.sa
QMS_WEBHOOK_SECRET   = [من النظام: إعدادات > إعدادات AI > Webhook Secret]
WHATSAPP_GROUP_ID    = [معرف مجموعة Telegram/WhatsApp]
QUALITY_MANAGER_EMAIL = [بريد مدير الجودة]
MANAGEMENT_EMAILS    = [بريد الإدارة، مفصول بفواصل]
```

---

## الحصول على Webhook Secret

1. افتح نظام الجودة → **إعدادات AI**
2. في قسم "إعدادات الأتمتة الخارجية"
3. انسخ قيمة **Webhook Secret**
4. أضفها كـ `QMS_WEBHOOK_SECRET` في n8n

---

## API Endpoints المستخدمة

| Endpoint | الطريقة | الوظيفة |
|----------|---------|---------|
| `/api/automation/alerts` | GET | التنبيهات المصنَّفة |
| `/api/automation/departments` | GET | حالة كل قسم |
| `/api/automation/weekly-report` | POST | توليد تقرير أسبوعي |
| `/api/automation/status` | GET | لقطة عامة للنظام |
| `/api/automation/kpi-summary` | GET | ملخص مؤشرات الأداء |

جميعها تتطلب Header: `x-webhook-secret: [القيمة]`

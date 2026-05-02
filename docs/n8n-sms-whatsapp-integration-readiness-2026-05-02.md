# تجهيز التكامل مع n8n و SMS و WhatsApp

## القرار المعتمد

يكون n8n هو مركز الإرسال الخارجي. نظام الجودة لا يحتفظ بمفاتيح SMS Gateway أو WhatsApp API داخل الكود، بل يرسل حدثًا موحدًا وموقعًا إلى n8n، ثم يقوم n8n باختيار القناة المناسبة وتنفيذ الإرسال.

## ما تم تجهيزه في النظام

- سجل `IntegrationDelivery` لحفظ كل محاولة إرسال خارجي.
- إرسال أحداث مؤشرات المتابعة المتأخرة إلى n8n عند إنشاء التنبيه الداخلي لأول مرة.
- Callback من n8n لتحديث حالة الرسالة بعد الإرسال.
- إدراج سجل متأخرات المؤشرات ضمن `/api/automation/alerts`.
- احترام إعدادات n8n الحالية: `n8n_webhook_url`, `n8n_webhook_secret`, `n8n_webhook_enabled`.

## أحداث المرحلة الأولى

| الحدث | متى يرسل | المستلم |
|---|---|---|
| `KPI_FOLLOWUP_FIRST_NOTICE` | عند وصول المتابعة إلى أول تنبيه | مدخل بيانات المؤشر |
| `KPI_FOLLOWUP_ESCALATED_L1` | عند التصعيد الأول | مدير القسم |
| `KPI_FOLLOWUP_ESCALATED_L2` | عند التصعيد الحرج | مدير الجودة ومسؤول النظام |

## شكل الطلب الخارج إلى n8n

يرسل النظام `POST` إلى رابط n8n المحفوظ في الإعدادات، مع:

```http
X-QMS-Event: KPI_FOLLOWUP_ESCALATED_L1
X-QMS-Signature: sha256=<hmac>
Content-Type: application/json
```

والجسم:

```json
{
  "event": "KPI_FOLLOWUP_ESCALATED_L1",
  "timestamp": "2026-05-02T20:00:00.000Z",
  "data": {
    "deliveryId": "clx...",
    "eventKey": "KFU_ESC_L1:followupId:userId:2026-05-02:N8N",
    "title": "تصعيد: مؤشر KPI-001 متأخر",
    "message": "الموظف لم يدخل قراءة المؤشر لشهر 4/2026 (12 يوم).",
    "entity": {
      "type": "KpiFollowUp",
      "id": "clx...",
      "link": "/qms#/kpiFollowUp"
    },
    "recipient": {
      "id": "clx...",
      "name": "اسم المستلم",
      "email": "user@example.org",
      "phone": "9665xxxxxxxx",
      "role": "DEPT_MANAGER",
      "preferredChannels": ["WHATSAPP", "SMS", "EMAIL"]
    },
    "data": {
      "followUpCode": "KFU-2026-0001",
      "indicatorCode": "KPI-001",
      "indicatorName": "نسبة إدخال المؤشرات في وقتها",
      "departmentName": "إدارة الخدمة المجتمعية",
      "year": 2026,
      "month": 4,
      "daysLate": 12,
      "status": "ESCALATED",
      "escalationLevel": 1
    }
  }
}
```

## Callback المطلوب من n8n

بعد تنفيذ الإرسال، يستدعي n8n:

```http
POST /api/automation/delivery-status
X-Webhook-Secret: <n8n_webhook_secret>
```

```json
{
  "deliveryId": "clx...",
  "status": "DELIVERED",
  "channel": "WHATSAPP",
  "provider": "whats-api",
  "providerMessageId": "wamid...",
  "response": {
    "raw": "provider response"
  }
}
```

القيم المقبولة للحالة:

- `DISPATCHED`
- `DELIVERED`
- `FAILED`
- `SKIPPED`

## ضوابط مهمة

- لا يتم إرسال نفس الحدث الخارجي مرتين إذا سبق تسجيله كـ `DISPATCHED` أو `DELIVERED`.
- إذا كان n8n غير مفعل، تحفظ المحاولة كـ `SKIPPED` ويمكن إعادة إرسالها لاحقًا عند تفعيل n8n.
- القنوات المقترحة تحسب من بيانات المستلم: وجود رقم جوال يعني WhatsApp و SMS، ووجود بريد يعني Email.
- مفاتيح WhatsApp و SMS تبقى داخل n8n فقط.

## الخطوة التالية للمطور

يبني workflow في n8n كالتالي:

1. Webhook Trigger يستقبل أحداث QMS.
2. IF/Switch حسب `event`.
3. تحقق من `recipient.preferredChannels`.
4. إرسال WhatsApp أولًا عند وجود رقم.
5. fallback إلى SMS عند فشل WhatsApp.
6. fallback إلى Email عند وجود بريد.
7. استدعاء `/api/automation/delivery-status` بنتيجة الإرسال.

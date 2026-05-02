# Phase 3 — قواعد الإرسال (مؤجَّلة)

> هذه الوثيقة تُسجِّل بصراحة ما **لم يُنفَّذ بعد** من قرار المشرف،
> لتكون نقطة بداية واضحة عند البدء بـ Phase 3.

## ما الذي اكتمل في Phase 1+2

| البند | الحالة | الموقع |
|------|--------|--------|
| إعدادات n8n (URL/secret/enabled/test) | ✅ | `routes/webhookSettings.js` + UI |
| Secret encryption (AES-256-GCM) | ✅ | `lib/ai/crypto.js` |
| SSRF prevention | ✅ | `validateWebhookUrl()` |
| Connection status (متصل/معطّل/فشل/لم يُختبر) | ✅ | GET `/webhook-settings` extended |
| Last test result + last success + last failure | ✅ | extended endpoint |
| n8n callback endpoint (HMAC verified) | ✅ | `POST /api/integrations/delivery-status` |
| سجل الإرسال (IntegrationDelivery) | ✅ | model + UI tab |
| قوالب رسائل قابلة للتعديل | ✅ | `NotificationTemplate` model + 5 seeds |
| Variables {{employeeName}}, {{indicatorName}}…  | ✅ | renderer in `notificationDispatcher.js` |
| القنوات (IN_APP / WHATSAPP / SMS / EMAIL) | ✅ | per-template + UI toggles |
| ربط detector بقوالب القاعدة | ✅ | `notifyEscalatedFollowUps()` |
| Anti-duplication (نفس الحدث في اليوم) | ✅ | عبر `eventKey` daily key |

## ما لم يُنفَّذ — Phase 3

### 3.1 — نوافذ الإرسال (Time Windows)
**المطلوب:** منع الإرسال خارج أوقات العمل، مثلاً 8 ص → 8 م، الأحد→الخميس فقط.

**التصميم المقترح:**
- إضافة جدول `DeliveryRule` يحوي:
  - `sendStartHour` (0-23)
  - `sendEndHour` (0-23)
  - `allowedDays` (CSV: SUN,MON,TUE,WED,THU)
  - `timezone` (Asia/Riyadh)
- في `notificationDispatcher.sendNotification()`:
  - إن كان الوقت خارج النافذة → تأجيل (queue) بدل التخطي
  - إنشاء `DeliveryQueue` table مع `scheduledFor` لاحقاً

**سبب التأجيل:** يتطلب قرار من المشرف بشأن:
- هل التأجيل = re-schedule (احتفظ بـ entry)، أم تخطٍ صامت؟
- هل النافذة موحَّدة لكل القوالب أم لكل قالب؟

### 3.2 — إعادة المحاولة (Retry)
**المطلوب:** عند فشل n8n → 3 محاولات بفواصل 15د/ساعة/يوم.

**التصميم المقترح:**
- إضافة لـ `IntegrationDelivery`:
  - `attemptCount` (default 0)
  - `nextRetryAt` (DateTime?)
  - `maxAttempts` (default 3)
- خلفية يقرأها scheduler الموجود ويُعيد إرسال FAILED ذو `nextRetryAt <= NOW`.
- exponential backoff: `15min → 1h → 24h`.

**سبب التأجيل:** يتطلب job-runner (موجود لكن نمط استخدامه يجب توحيده مع scheduler الموجود).

### 3.3 — أولوية القنوات (Channel Routing)
**المطلوب:** WhatsApp أولاً → SMS → Email — حسب توفر كل قناة وفشلها.

**التصميم المقترح:**
- داخل n8n نفسها (وليس في QMS):
  - n8n يستلم event مع `requestedChannels: ['WHATSAPP','SMS','EMAIL']`
  - n8n workflow يحاول WhatsApp أولاً → فشل → SMS → فشل → Email
- QMS فقط يُسجِّل **النية** (channels list) ويستقبل callback نهائي
- لا يحتاج تغييراً في QMS — الذكاء كله في n8n

**سبب التأجيل:** قرار معماري صحيح للمستقبل.
هذا الجزء **لا يتطلب أي عمل في QMS** بل في n8n workflow.

### 3.4 — منع التكرار اليومي (Anti-spam)
**المُنفَّذ جزئياً:** `eventKey` يتضمن `:today` بالفعل.
**المطلوب الكامل:** قفل أكثر صرامة لكل (recipient, eventKey-prefix, day) — حتى لو تغيّر الـ followUp id.

**التصميم المقترح:**
- جدول `NotificationDailyLock`:
  - `(userId, eventKeyPrefix, date)` UNIQUE
  - يُفحص قبل إرسال كل تنبيه
  - يُحذف بعد 30 يوم بـ scheduler

**سبب التأجيل:** الحماية الحالية كافية للحالات الشائعة. النسخة الأقوى تأتي عند رصد spam فعلي.

### 3.5 — تتبع التسليم متعدد القنوات
**المطلوب:** لو أُرسلت رسالة عبر WhatsApp وفشلت ثم نجحت SMS، نريد رؤية القناة النهائية.

**التصميم المقترح:**
- `IntegrationDelivery` يدعم القناة الواحدة حالياً
- إضافة `IntegrationDeliveryAttempt` (1:N):
  - `attemptNumber`, `channel`, `provider`, `status`, `error`, `at`
- المُجمَّع `IntegrationDelivery.status = LAST_ATTEMPT.status`

**سبب التأجيل:** في n8n نفسها يمكن أن تُرسل status لكل محاولة، وحالياً نقبل status نهائي واحد. الحاجة الفعلية لا تظهر إلا عند تشغيل مزود WhatsApp فعلي.

## معايير القبول لـ Phase 3 (عند البدء)

- [ ] صفحة "قواعد الإرسال" منفصلة في إعدادات التكاملات
- [ ] حفظ نوافذ الإرسال + الأيام + المنطقة الزمنية
- [ ] tabular UI لإدارة `DeliveryRule` لكل قالب
- [ ] إعادة محاولة تلقائية مع ظهور المحاولات في سجل الإرسال
- [ ] اختبار end-to-end: تنبيه يصل خارج النافذة → يؤجَّل → يُرسل في الموعد

## ملاحظة شخصية للمطور القادم

البنية الحالية تحتمل Phase 3 بدون refactor كبير. كل ما يلزم:
1. جدول `DeliveryRule` جديد
2. حقول إضافية في `IntegrationDelivery` (attemptCount, nextRetryAt)
3. middleware في `sendNotification()` يفحص النافذة قبل الإرسال
4. job في `scheduler.js` يقرأ FAILED ويُعيد المحاولة

لا حاجة لإعادة تصميم core notification flow.

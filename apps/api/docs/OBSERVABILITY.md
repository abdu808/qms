# Observability Cheat Sheet

ثلاثة أنواع لوج جاهزة في الكود، كل سطر مبدوء بـ prefix يسهل grep.

## 1. `[slow-query]` — استعلام Prisma تجاوز العتبة

```
[slow-query] beneficiary.findMany 823ms
```

- العتبة افتراضياً `500ms`. غيّرها بـ `SLOW_QUERY_MS=1000` في env.
- لو لوج بتظهر كل دقيقة → DB محتاج index أو الاستعلام فيه N+1.

**جمع لمدة 48 ساعة ثم عمل top-N:**
```sh
docker logs qms-api 2>&1 | grep '\[slow-query\]' \
  | awk '{print $2}' | sort | uniq -c | sort -rn | head -10
```

## 2. `[prisma-error]` — فشل استعلام

```
[prisma-error] nCR.create 12ms [P2002] Unique constraint failed on the fields: (`code`) meta={"target":["code"]}
```

- يطبع `code` (P2002/P2003/P2025…) و`meta` كامل.
- P2002 على `code` يُمتص تلقائياً بـ retry في `crudFactory`.
- P2002 على `email/nationalId/…` → تكرار حقيقي، صالح للمستخدم.
- P2003 → FK فشل. يعني frontend يرسل id لجدول غير موجود.

## 3. `[slow-request]` — HTTP request تجاوز العتبة

```
[slow-request] POST /api/ncr 2450ms user=abu8...
```

- العتبة افتراضياً `1500ms`. غيّرها بـ `SLOW_REQUEST_MS=3000`.
- مفيد لكشف متى HTTP بطيء بدون اختناق DB (i.e. external fetch).

## 4. `/api/health/ready` — deep healthcheck

يضرب `SELECT 1` على Prisma. لو رجع 503، DB منقطع أو connection pool مستنفد.
Docker HEALTHCHECK يستخدمه. لو الحاوية تنقلب إلى `unhealthy` بعد النشر = DB عنده مشكلة.

## Triage سريع للاختناقات

1. فتح `/api/health/ready` — لو 200، API ود DB شغالين.
2. `grep '\[slow-query\]' logs | wc -l` → لو أكثر من 10/دقيقة → ابحث عن مودل متكرر.
3. `grep '\[prisma-error\]' logs | tail -50` → الأخطاء الحقيقية (ليست P2002/P2025).
4. لو كل شيء هادئ والـ 504 موجود → مش DB، غالباً nginx أو ذاكرة.

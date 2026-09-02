# مراقبة استهلاك الحاويات — QMS على Coolify

> يجيب هذا الدليل عن سؤال: **كم تستهلك حاويات النظام من CPU وذاكرة وقرص؟ وهل الحدود كافية؟**
> مكمّل لـ [`operations.md`](./operations.md) §6.3 (تجاوز حدود الذاكرة أو CPU).

---

## 0. الطريق الأسرع

على **سيرفر Coolify** (SSH) أو من **Coolify Terminal** لأي حاوية:

```bash
# داخل حاوية qms-api (Coolify Terminal)
cd /app && ./scripts/container-usage.sh

# على سيرفر Coolify، من نسخة المستودع
./apps/api/scripts/container-usage.sh qms
```

> السكربت يُشحن داخل الصورة (`/app/scripts/container-usage.sh`) لأن الـ Dockerfile
> ينسخ `apps/api/` كاملاً — فلا حاجة إلى نسخه يدوياً بعد كل نشر.

السكربت يكتشف بيئته تلقائياً:

| أين تشغّله | ما يعطيك |
|------------|----------|
| سيرفر Coolify (يوجد `docker`) | تقرير كامل: كل الحاويات + الـ volumes + موارد السيرفر |
| داخل حاوية `qms-api` (لا `docker`) | استهلاك هذه الحاوية فقط عبر cgroup + حجم `/app/uploads` |

خيارات: أضف `--watch` للتحديث المستمر كل 5 ثوانٍ.

---

## 1. الأوامر اليدوية (على سيرفر Coolify)

### 1.1 لقطة لحظية

```bash
docker stats --no-stream \
  --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"
```

| العمود | المعنى | متى تقلق |
|--------|--------|-----------|
| `CPU %` | نسبة من نواة واحدة (200% = نواتان) | ثبات فوق `80% × عدد الأنوية` |
| `MEM USAGE / LIMIT` | المستخدم مقابل الحد | الاقتراب من الحد → خطر OOM |
| `MEM %` | نسبة الاستهلاك من الحد | > 85% باستمرار |
| `NET I/O` | مجموع الوارد/الصادر منذ الإقلاع | قفزات غير مبرَّرة |
| `BLOCK I/O` | قراءة/كتابة على القرص | كتابة عالية = سجلات أو backups |

> `docker stats` تراكمي منذ إقلاع الحاوية؛ لمقارنة عادلة سجّل قيمتين بفارق زمني.

### 1.2 هل أُعيد تشغيل الحاوية؟ (مؤشر OOM)

```bash
docker inspect qms-api \
  --format 'restarts={{.RestartCount}} status={{.State.Status}} oom={{.State.OOMKilled}} exit={{.State.ExitCode}}'
```

`oom=true` أو `exit=137` ⇒ قُتلت الحاوية لتجاوز الذاكرة. راجع §3.

### 1.3 استهلاك القرص

```bash
docker system df          # ملخص: صور / حاويات / volumes / build cache
docker system df -v       # تفصيل لكل volume (يهمّنا qms_uploads و qms_db_data)
docker ps -s --format "table {{.Names}}\t{{.Size}}"   # حجم الطبقة القابلة للكتابة
```

تنظيف آمن عند امتلاء القرص (لا يمسّ الـ volumes أو الحاويات العاملة):

```bash
docker image prune -a -f      # صور غير مستخدمة — Coolify يخلّف صوراً قديمة
docker builder prune -f       # build cache
```

> **لا تشغّل** `docker system prune --volumes` — يحذف `qms_uploads` و`qms_db_data`.

### 1.4 موارد السيرفر نفسه

```bash
free -h; nproc; uptime
df -h / /var/lib/docker
```

---

## 2. من داخل حاوية `qms-api` (بدون صلاحية docker)

Coolify → Applications → **qms-api** → **Terminal**:

```bash
# الذاكرة والحد (cgroup v2)
echo "used: $(cat /sys/fs/cgroup/memory.current)"
echo "max : $(cat /sys/fs/cgroup/memory.max)"
grep oom_kill /sys/fs/cgroup/memory.events

# ذاكرة عملية Node ونسبة heap
ps -o pid,rss,etime,args -e | grep -v grep | grep node
node -e "const m=process.memoryUsage();for(const k in m)console.log(k, (m[k]/1048576).toFixed(1)+' MiB')"

# حجم المرفقات والنسخ الاحتياطية — أكبر مستهلك للقرص عادةً
du -sh /app/uploads /app/uploads/backups
df -h /app
```

على cgroup v1 استبدل المسارات بـ `/sys/fs/cgroup/memory/memory.usage_in_bytes`
و`memory.limit_in_bytes` و`memory.failcnt`.

---

## 3. القراءة والتصرّف

| الملاحظة | التفسير المرجّح | الإجراء |
|----------|------------------|---------|
| `MEM %` > 85% مع `restarts` متزايد | حد الذاكرة ضيّق أو تسريب | ارفع الحد في Coolify → Resources، ثم راقب 24 ساعة قبل الحكم على وجود تسريب |
| `oom=true` / `exit=137` | قتل بسبب الذاكرة | نفس ما سبق + راجع `docker logs qms-api \| grep -i "heap\|memory"` |
| `CPU %` مرتفع باستمرار | استعلامات ثقيلة أو rollup للمؤشرات | راجع Neon → Monitoring، وسجلات `[kpi] rollup` |
| `BLOCK I/O` كتابة عالية ليلاً | مهمة النسخ الاحتياطي 02:00 | طبيعي — تحقق فقط من `BACKUP_RETENTION_DAYS` |
| القرص يمتلئ | صور Coolify القديمة أو `/app/uploads/backups` | §1.3 + قلّل `BACKUP_RETENTION_DAYS` |
| `qms_db_data` ينمو بلا توقف | الحاوية المحلية للـ Postgres | الإنتاج يستخدم Neon؛ تأكد أن هذه الحاوية غير مطلوبة أصلاً |

### حدود الموارد في Coolify

Coolify → التطبيق → **Resource Limits**: تُترجَم إلى `--memory` و`--cpus`.
بدون ضبطها ترث الحاوية موارد السيرفر كاملة — أي أن حاوية واحدة قادرة على خنق البقية.
القيمة الابتدائية المقترحة لـ `qms-api`: ذاكرة `1g`، معالج `1.0`، ثم تُعدَّل بناءً على القياس.

---

## 4. المتابعة الدورية

- **Coolify → Metrics**: رسوم CPU/ذاكرة تاريخية لكل تطبيق (الأسرع للنظرة السريعة).
- **أسبوعياً**: شغّل `./apps/api/scripts/container-usage.sh qms` واحفظ اللقطة للمقارنة.
- **بعد كل نشر كبير**: قارن `MEM USAGE` قبل/بعد — القفزة الدائمة تعني تغيّراً في البصمة.

> لا تنسخ أي متغيّر بيئة أو مفتاح في الشات؛ أوامر هذا الدليل لا تطبع أياً منها.

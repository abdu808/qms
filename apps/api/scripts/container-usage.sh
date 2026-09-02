#!/bin/sh
# ──────────────────────────────────────────────────────────────
# container-usage.sh — تقرير استهلاك الحاويات (CPU / ذاكرة / قرص / شبكة)
#
# POSIX sh — يعمل داخل صورة alpine (لا يتطلب bash).
#
# يُشغَّل في أحد موضعين:
#   1) سيرفر Coolify (يوجد docker)  → تقرير كامل لكل الحاويات
#   2) داخل حاوية qms-api من Coolify Terminal (لا يوجد docker)
#      → يتحوّل تلقائياً إلى قراءة cgroup للحاوية نفسها
#
# الاستخدام:
#   cd /app && ./scripts/container-usage.sh          # داخل الحاوية
#   ./apps/api/scripts/container-usage.sh qms        # على السيرفر، مرشَّح بالاسم
#   ./apps/api/scripts/container-usage.sh qms --watch
#
# لا يطبع أي متغير بيئة أو مفتاح — آمن للصق في الشات.
# ──────────────────────────────────────────────────────────────
set -eu

FILTER=""
WATCH="no"
for arg in "$@"; do
  case "$arg" in
    --watch) WATCH="yes" ;;
    -*)      ;;
    *)       [ -z "$FILTER" ] && FILTER="$arg" ;;
  esac
done

BLU=$(printf '\033[34m'); GRN=$(printf '\033[32m')
YLW=$(printf '\033[33m'); RST=$(printf '\033[0m')
TAB=$(printf '\t')
CG=/sys/fs/cgroup

sect() { echo; echo "${BLU}══ $* ${RST}"; }
warn() { echo "${YLW}!${RST} $*"; }

human() { # bytes → قراءة بشرية
  awk -v b="${1:-0}" 'BEGIN{
    split("B KiB MiB GiB TiB", u, " "); i = 1
    while (b >= 1024 && i < 5) { b /= 1024; i++ }
    printf "%.1f %s", b, u[i]
  }'
}

# القيم الضخمة في cgroup تعني عملياً "بلا حد"
print_limit() { # $1=used  $2=limit أو "max"
  if [ "$2" = "max" ] || ! [ "$2" -lt 9007199254740992 ] 2>/dev/null; then
    echo "حد الذاكرة       : غير محدّد (يرث حد السيرفر)"
  else
    echo "حد الذاكرة       : $(human "$2")  ($(awk -v u="$1" -v m="$2" 'BEGIN{printf "%.1f", u*100/m}')% مستخدم)"
  fi
}

# ── الوضع 2: داخل الحاوية (لا docker) ─────────────────────────
self_report() {
  sect "استهلاك هذه الحاوية (cgroup)"

  if [ -r "$CG/memory.current" ]; then                    # cgroup v2
    used=$(cat "$CG/memory.current")
    max=$(cat "$CG/memory.max" 2>/dev/null || echo max)
    echo "الذاكرة المستخدمة : $(human "$used")"
    print_limit "$used" "$max"
    [ -r "$CG/memory.peak" ] && echo "أعلى قيمة سُجّلت  : $(human "$(cat "$CG/memory.peak")")"
    if [ -r "$CG/memory.events" ]; then
      oom=$(awk '/^oom_kill /{print $2}' "$CG/memory.events")
      if [ "${oom:-0}" != "0" ]; then
        warn "حدث OOM kill ${oom} مرة — الذاكرة غير كافية"
      else
        echo "OOM kills        : 0"
      fi
    fi
    if [ -r "$CG/cpu.stat" ]; then
      awk '/^usage_usec/{printf "زمن CPU الكلي    : %.1f ثانية\n", $2/1000000}' "$CG/cpu.stat"
      awk '/^throttled_usec/{ if ($2 > 0) print "! تم خنق CPU (throttling) — الحد ضيّق" }' "$CG/cpu.stat"
    fi

  elif [ -r "$CG/memory/memory.usage_in_bytes" ]; then     # cgroup v1
    used=$(cat "$CG/memory/memory.usage_in_bytes")
    max=$(cat "$CG/memory/memory.limit_in_bytes" 2>/dev/null || echo max)
    echo "الذاكرة المستخدمة : $(human "$used")"
    print_limit "$used" "$max"
    [ -r "$CG/memory/memory.max_usage_in_bytes" ] \
      && echo "أعلى قيمة سُجّلت  : $(human "$(cat "$CG/memory/memory.max_usage_in_bytes")")"
    if [ -r "$CG/memory/memory.failcnt" ]; then
      fc=$(cat "$CG/memory/memory.failcnt")
      if [ "$fc" != "0" ]; then
        warn "تجاوز حد الذاكرة ${fc} مرة (failcnt) — راجع الحد في Coolify"
      else
        echo "تجاوزات الحد     : 0"
      fi
    fi
    [ -r "$CG/cpuacct/cpuacct.usage" ] \
      && awk -v n="$(cat "$CG/cpuacct/cpuacct.usage")" \
             'BEGIN{printf "زمن CPU الكلي    : %.1f ثانية\n", n/1000000000}'
  else
    warn "تعذّرت قراءة cgroup — لا معلومات استهلاك متاحة من الداخل."
  fi

  sect "ذاكرة عمليات Node"
  if command -v ps >/dev/null 2>&1; then
    { ps -o pid,rss,etime,args -e 2>/dev/null || ps -o pid,rss,args -e 2>/dev/null || ps; } \
      | awk 'NR==1 || (/node/ && !/awk|container-usage/)' | head -10 | cut -c1-110
  else
    warn "ps غير متاح في هذه الصورة"
  fi
  if command -v node >/dev/null 2>&1; then
    node -e 'const m=process.memoryUsage();for(const k of ["rss","heapTotal","heapUsed","external"])console.log("  "+k.padEnd(11)+(m[k]/1048576).toFixed(1)+" MiB")' 2>/dev/null || true
  fi

  sect "استهلاك القرص"
  du -sh /app/uploads 2>/dev/null || true
  du -sh /app/uploads/backups 2>/dev/null || true
  df -h /app 2>/dev/null | awk 'NR<=2'
}

# ── الوضع 1: على سيرفر Coolify ────────────────────────────────
host_report() {
  if [ -n "$FILTER" ]; then
    ids=$(docker ps -q --filter "name=${FILTER}")
  else
    ids=$(docker ps -q)
  fi

  if [ -z "$ids" ]; then
    if [ -n "$FILTER" ]; then
      warn "لا توجد حاويات تعمل مطابقة لـ \"$FILTER\"."
    else
      warn "لا توجد حاويات تعمل."
    fi
    return
  fi

  sect "الاستهلاك اللحظي (CPU / ذاكرة / شبكة / قرص)"
  # shellcheck disable=SC2086
  docker stats --no-stream \
    --format "table {{.Name}}${TAB}{{.CPUPerc}}${TAB}{{.MemUsage}}${TAB}{{.MemPerc}}${TAB}{{.NetIO}}${TAB}{{.BlockIO}}${TAB}{{.PIDs}}" $ids

  sect "الحالة وإعادة التشغيل و OOM"
  printf "%-26s %-12s %-9s %-7s %s\n" "NAME" "STATUS" "RESTARTS" "OOM" "HEALTH"
  for id in $ids; do
    docker inspect "$id" --format \
      '{{printf "%-26.26s %-12.12s %-9d %-7v %s" (slice .Name 1) .State.Status .RestartCount .State.OOMKilled (or .State.Health.Status "-")}}' \
      2>/dev/null || docker inspect "$id" --format \
      '{{.Name}} {{.State.Status}} restarts={{.RestartCount}} oom={{.State.OOMKilled}}'
    echo
  done

  sect "استهلاك القرص (صور / حاويات / volumes)"
  docker system df

  sect "تفصيل الـ volumes"
  docker system df -v 2>/dev/null | awk '/^VOLUME NAME/{f=1} f' | head -15 || true

  sect "موارد السيرفر نفسه"
  echo "Load average : $(cut -d' ' -f1-3 /proc/loadavg)"
  echo "المعالجات    : $(nproc 2>/dev/null || echo '?') نواة"
  free -h 2>/dev/null | awk 'NR<=2' || true
  df -h / /var/lib/docker 2>/dev/null | awk '!seen[$0]++'
}

main() {
  echo "${GRN}تقرير استهلاك الحاويات${RST} — $(date '+%Y-%m-%d %H:%M:%S %Z')"
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    host_report
  else
    warn "docker غير متاح هنا — التقرير مقتصر على هذه الحاوية."
    self_report
  fi
  echo
}

if [ "$WATCH" = "yes" ]; then
  while true; do
    command -v clear >/dev/null 2>&1 && clear
    main
    echo "(تحديث كل 5 ثوانٍ — Ctrl+C للإيقاف)"
    sleep 5
  done
else
  main
fi

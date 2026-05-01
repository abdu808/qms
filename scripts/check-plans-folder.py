"""فحص ملفات الخطط لمعرفة التوافق مع النظام"""
import pandas as pd, sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

FOLDER = r'C:\Users\abdu8\Documents\dev\qms\ISO9001\الخطط والمشرات'

files = [
    'الخطة الاستراتيجية جمعية البر صبياء محدثة.xlsx',
    'الخطة_التشغيلية_2026_التنفيذ.xlsx',
    'الخطة_التشغيلية_2026_الميزانية.xlsx',
    'KPI_Playbook_v10.xlsx',
    'مؤشرات باقي الاقسام- مسودة.xlsx',
]

for f in files:
    path = os.path.join(FOLDER, f)
    if not os.path.exists(path):
        print(f"\n❌ غير موجود: {f}")
        continue
    print(f"\n{'═'*70}\n📊 {f}\n{'═'*70}")
    try:
        xl = pd.ExcelFile(path)
        print(f"الأوراق: {len(xl.sheet_names)} — {', '.join(xl.sheet_names[:5])}")
        for s in xl.sheet_names[:3]:
            df = pd.read_excel(xl, s, header=None, nrows=5)
            print(f"\n── ورقة: {s} ── (شكل: {df.shape})")
            print(df.head(5).to_string()[:1500])
    except Exception as e:
        print(f"خطأ: {e}")

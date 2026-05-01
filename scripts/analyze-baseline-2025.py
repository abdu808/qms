"""
تحليل ملف المستفيدين 2026-05-01 لاستخراج خط الأساس الفعلي 2025
"""
import pandas as pd
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

XLSX = r'C:\Users\abdu8\Downloads\01 مايو 2026.xlsx'
df = pd.read_excel(XLSX, sheet_name='Sheet1')

print(f"إجمالي السجلات: {len(df):,}")
print()

# توزيع حالة الملف
print("=== توزيع حالة الملف ===")
print(df['حالة الملف'].value_counts(dropna=False).to_string())
print()

# فئة الملف
print("=== فئة الملف ===")
print(df['فئة الملف'].value_counts(dropna=False).head(20).to_string())
print()

# نوع المستفيد
print("=== النوع ===")
print(df['النوع'].value_counts(dropna=False).head(10).to_string())
print()

# الحالة الاجتماعية
print("=== الحالة الإجتماعية ===")
print(df['الحالة الإجتماعية'].value_counts(dropna=False).head(10).to_string())
print()

# يحتاج لكفالة
print("=== يحتاج لكفالة ===")
print(df['يحتاج لكفالة'].value_counts(dropna=False).head(10).to_string())
print()

# عدد الأيتام
yatim_total = df['عدد الأيتام'].fillna(0).astype(float).sum()
print(f"إجمالي الأيتام في كل الملفات: {yatim_total:,.0f}")
print()

# تواريخ الإنشاء
df['تاريخ الإنشاء'] = pd.to_datetime(df['تاريخ الإنشاء'], errors='coerce')
df['year'] = df['تاريخ الإنشاء'].dt.year
print("=== ملفات أُنشئت لكل سنة ===")
print(df['year'].value_counts(dropna=False).sort_index().to_string())
print()

# الإحتياجات
print("=== توزيع الإحتياجات (أعلى 15) ===")
ihtiyajat = df['الإحتياجات'].dropna()
print(ihtiyajat.value_counts().head(15).to_string())
print()

# دخل الأسرة - إحصاء
print("=== دخل الأسرة (الإحصائيات) ===")
income = pd.to_numeric(df['دخل الإسرة'], errors='coerce').dropna()
print(f"عدد بيانات الدخل: {len(income)}")
print(f"المتوسط: {income.mean():,.0f} ريال")
print(f"الوسيط: {income.median():,.0f} ريال")
print(f"أقل دخل: {income.min():,.0f}")
print(f"أعلى دخل: {income.max():,.0f}")
print()

# عدد الأسر النشطة (حالة الملف = نشط أو مفعل)
active = df[df['حالة الملف'].astype(str).str.contains('نشط|فعل|مقبول|قائم', na=False, regex=True)]
print(f"الأسر النشطة (تقريبياً): {len(active):,}")

# قسم خاص بالكفالة
print()
print("=== الأيتام بحاجة لكفالة ===")
needs_kafala = df[df['يحتاج لكفالة'].astype(str).str.contains('نعم|yes|true', na=False, case=False)]
print(f"حالات تحتاج لكفالة: {len(needs_kafala):,}")
yatim_in_kafala = needs_kafala['عدد الأيتام'].fillna(0).astype(float).sum()
print(f"إجمالي الأيتام في حالات تحتاج لكفالة: {yatim_in_kafala:,.0f}")

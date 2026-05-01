"""قراءة قائمة التحقق"""
import pdfplumber, sys, io, os, glob
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

downloads = r'C:\Users\abdu8\Downloads'
# جميع PDFs بنمط مرن
all_pdfs = [f for f in os.listdir(downloads) if f.endswith('.pdf')]
matches = [f for f in all_pdfs if 'قائمة' in f or 'التحقق' in f]
print(f"عدد PDF في Downloads: {len(all_pdfs)}")
print(f"المطابقات: {len(matches)}")
for m in matches:
    print(f"  - {repr(m)}")
print()

target = None
for m in matches:
    if '(2)' in m:
        target = m
        break
if not target and matches:
    target = matches[0]

if target:
    full = os.path.join(downloads, target)
    print(f"📄 قراءة: {target}\n")
    try:
        with pdfplumber.open(full) as pdf:
            print(f"عدد الصفحات: {len(pdf.pages)}")
            for i, page in enumerate(pdf.pages):
                text = (page.extract_text() or '').strip()
                if text:
                    print(f"\n══════ صفحة {i+1} ══════")
                    print(text)
    except Exception as e:
        print(f"خطأ: {e}")

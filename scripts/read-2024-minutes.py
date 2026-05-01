"""قراءة محضر 11-2024"""
import pdfplumber, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

PDF = r'C:\Users\abdu8\Downloads\11-2024.pdf'
try:
    with pdfplumber.open(PDF) as pdf:
        print(f"عدد الصفحات: {len(pdf.pages)}")
        text_total = 0
        for i, page in enumerate(pdf.pages):
            text = (page.extract_text() or '').strip()
            if text:
                text_total += 1
                print(f"\n══════ صفحة {i+1} ══════")
                print(text[:3000])
        print(f"\n[صفحات بنص: {text_total}/{len(pdf.pages)}]")
except Exception as e:
    print(f"خطأ: {e}")

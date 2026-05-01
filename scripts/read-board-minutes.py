"""قراءة محضر مجلس الإدارة"""
import pdfplumber, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

PDF = r'C:\Users\abdu8\Downloads\1-2026.pdf'
try:
    with pdfplumber.open(PDF) as pdf:
        print(f"عدد الصفحات: {len(pdf.pages)}")
        text_pages = 0
        for i, page in enumerate(pdf.pages):
            text = (page.extract_text() or '').strip()
            if text:
                text_pages += 1
                print(f"\n══════ صفحة {i+1} ══════")
                print(text[:3000])
        print(f"\n[صفحات بنص: {text_pages}/{len(pdf.pages)}]")
except Exception as e:
    print(f"خطأ pdfplumber: {e}")
    # محاولة بديلة بـ PyPDF2
    try:
        from PyPDF2 import PdfReader
        r = PdfReader(PDF)
        print(f"PyPDF2: {len(r.pages)} صفحة")
        for i, p in enumerate(r.pages):
            t = p.extract_text() or ''
            if t.strip():
                print(f"\n══ {i+1} ══\n{t[:2000]}")
    except Exception as e2:
        print(f"PyPDF2 خطأ: {e2}")

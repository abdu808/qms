"""قراءة قائمة التحقق وملف الجمعية"""
import pdfplumber
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

PDFS = [
    (r'C:\Users\abdu8\Downloads\)  قائمة التحقق لنظام إدارة الجودة (2).pdf', 'قائمة التحقق'),
    (r'C:\Users\abdu8\Downloads\مؤسسة جمعية البر الخيرية بصبياء.pdf', 'مؤسسة الجمعية'),
]

for pdf_path, label in PDFS:
    print(f"\n{'═'*70}")
    print(f"📄 {label}")
    print(f"{'═'*70}")
    try:
        with pdfplumber.open(pdf_path) as pdf:
            print(f"عدد الصفحات: {len(pdf.pages)}")
            text_pages = 0
            for i, page in enumerate(pdf.pages):
                text = (page.extract_text() or '').strip()
                if text:
                    text_pages += 1
                    print(f"\n── صفحة {i+1} ──")
                    print(text[:2500])
            print(f"\n[صفحات بنص: {text_pages}/{len(pdf.pages)}]")
    except Exception as e:
        print(f"خطأ: {e}")

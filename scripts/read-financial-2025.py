"""
قراءة التقرير المالي 2025 — جميع الصفحات
"""
import pdfplumber
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
PDF = r'C:\Users\abdu8\Downloads\2025.pdf'

with pdfplumber.open(PDF) as pdf:
    print(f"عدد الصفحات: {len(pdf.pages)}")
    has_text_pages = 0
    for i, page in enumerate(pdf.pages):
        text = (page.extract_text() or '').strip()
        if text:
            has_text_pages += 1
            print(f"\n========= صفحة {i+1} ({len(text)} حرف) =========")
            print(text[:2000])
    print(f"\nصفحات تحتوي نصاً: {has_text_pages} من {len(pdf.pages)}")

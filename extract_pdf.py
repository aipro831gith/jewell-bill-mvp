import pdfplumber
import sys
import json

def extract(pdf_path):
    print(f"--- EXTRACTING {pdf_path} ---")
    with pdfplumber.open(pdf_path) as pdf:
        for p in pdf.pages:
            words = p.extract_words()
            for w in words:
                text = w['text'].upper()
                if text in ['TAX', 'INVOICE', 'GSTIN', 'GSTIN:', 'PAN', 'STATE', 'BUYER', 'DETAILS', 'NAME:', 'CONTACT', 'CITY:', 'ADDRESS:', 'SR.', 'DESCRIPTION', 'HSN/SAC', 'WEIGHT', 'RATE', 'AMOUNT']:
                    # w['x0'] and w['top'] are in points. 1 point = 1/72 inch = 25.4/72 mm = 0.35277 mm
                    x_mm = w['x0'] * 0.35277
                    y_mm = w['top'] * 0.35277
                    print(f"Word: {w['text']} | X: {x_mm:.2f} mm | Y: {y_mm:.2f} mm")

extract(sys.argv[1])

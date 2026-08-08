import os
import sys

pdf_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "hscodewiselistwithgstrates.pdf")
print("PDF Path:", pdf_path)
print("Exists:", os.path.exists(pdf_path))

try:
    import fitz
    doc = fitz.open(pdf_path)
    print("Total pages:", len(doc))
    for i in range(min(5, len(doc))):
        print(f"=== PAGE {i+1} ===")
        txt = doc[i].get_text()
        print(txt[:1000] if txt else "[No text extracted]")
except Exception as e:
    print("Error with fitz:", e)

try:
    import pypdf
    reader = pypdf.PdfReader(pdf_path)
    print("pypdf pages:", len(reader.pages))
    for i in range(min(3, len(reader.pages))):
        print(f"=== PYPDF PAGE {i+1} ===")
        txt = reader.pages[i].extract_text()
        print(txt[:1000] if txt else "[No text extracted]")
except Exception as e:
    print("Error with pypdf:", e)

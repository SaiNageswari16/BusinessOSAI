import fitz
import json
import re
import os

pdf_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "hscodewiselistwithgstrates.pdf")
doc = fitz.open(pdf_path)

hsn_list = []

for page_idx in range(len(doc)):
    page_text = doc[page_idx].get_text()
    lines = page_text.split('\n')
    
    # We look for lines with 4 to 8 digit numbers (HSN codes) and GST rate % (0%, 5%, 12%, 18%, 28%)
    # Let's inspect block text per page
    blocks = doc[page_idx].get_text("blocks")
    for b in blocks:
        text = b[4].strip()
        # Look for HSN pattern (e.g. 8 digits or 4 digits) and GST rate
        matches = re.findall(r'(\d{4,8})\s*([A-Za-z0-9\s\-,/\(\)\[\]&]+?)\s*(\d{1,2}%)', text)
        for m in matches:
            code, desc, rate = m
            clean_code = code.strip()
            clean_desc = desc.strip()
            clean_rate = float(rate.replace('%', '').strip())
            if len(clean_code) >= 4 and clean_desc:
                hsn_list.append({
                    "hsn_code": clean_code,
                    "description": clean_desc,
                    "gst_rate": clean_rate
                })

print(f"Extracted {len(hsn_list)} initial HSN entries from regex blocks.")

# Better line-by-line / structural extraction
full_entries = []
for page_idx in range(len(doc)):
    page = doc[page_idx]
    text = page.get_text()
    
    # Extract code, commodity description, and GST rate
    # Rows in PDF table often have: Code | Commodity | Description | Rate
    # Let's find all 6-8 digit or 4 digit numbers
    hsn_matches = re.finditer(r'(\b\d{4,8}\b)(.*?)(0%|5%|12%|18%|28%)', text, re.DOTALL)
    for match in hsn_matches:
        code = match.group(1).strip()
        raw_desc = match.group(2).replace('\n', ' ').strip()
        rate_str = match.group(3).replace('%', '').strip()
        
        # Clean up description
        raw_desc = re.sub(r'\s+', ' ', raw_desc)
        # Remove SNO prefix if captured
        raw_desc = re.sub(r'^\d+\s*', '', raw_desc)
        
        if len(code) >= 4 and len(raw_desc) > 3:
            full_entries.append({
                "hsn_code": code,
                "description": raw_desc[:250],
                "gst_rate": float(rate_str)
            })

# Remove duplicates
unique_entries = {}
for item in full_entries:
    key = item["hsn_code"]
    if key not in unique_entries or len(item["description"]) > len(unique_entries[key]["description"]):
        unique_entries[key] = item

out_data = list(unique_entries.values())
print(f"Total unique HSN codes extracted: {len(out_data)}")

out_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "data", "hsn_codes_gst.json")
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(out_data, f, indent=2, ensure_ascii=False)

print(f"Saved HSN Code database to {out_path}")

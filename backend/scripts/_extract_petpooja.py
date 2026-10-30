"""Extract full text + embedded images from 'pet pooja.docx'.

Run:  python scripts/_extract_petpooja.py
Writes /tmp/petpooja_text.txt (full document text, paragraph order) and
extracts each embedded screenshot to /tmp/petpooja_media/NNN.<ext> so the
agent can Read the images directly.
"""
import os
import re
import zipfile

DOCX = os.path.join(os.path.dirname(__file__), "..", "..", "pet pooja.docx")
OUT_TEXT = "/tmp/petpooja_text.txt"
OUT_MEDIA = "/tmp/petpooja_media"

z = zipfile.ZipFile(DOCX)
doc = z.read("word/document.xml").decode("utf-8", "ignore")

# Paragraph order, with image placeholders where a drawing/inline pic appears.
segments = re.split(r"(<w:drawing>.*?</w:drawing>|<w:pict>.*?</w:pict>)", doc, flags=re.S)
paras = re.split(r"</w:p>", doc)
lines = []
for p in paras:
    texts = re.findall(r"<w:t[^>]*>(.*?)</w:t>", p, re.S)
    line = "".join(texts).strip()
    if line:
        lines.append(line)
text = "\n".join(lines)
with open(OUT_TEXT, "w", encoding="utf-8") as f:
    f.write(text)

os.makedirs(OUT_MEDIA, exist_ok=True)
media = [n for n in z.namelist() if n.startswith("word/media/")]
for i, name in enumerate(sorted(media), 1):
    ext = os.path.splitext(name)[1] or ".png"
    dest = os.path.join(OUT_MEDIA, f"{i:03d}{ext}")
    with open(dest, "wb") as f:
        f.write(z.read(name))

print("text chars:", len(text))
print("images:", len(media), "->", OUT_MEDIA)
print("docx size KB:", os.path.getsize(DOCX) // 1024)

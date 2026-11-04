#!/usr/bin/env python3
"""Patch footers: PAGE fields get explicit \\* ROMAN / \\* arabic switches (WPS compat),
and strip empty <w:pgNumType/> from document.xml (cover section)."""
import re, shutil, sys, zipfile, os

SRC = "/home/z/my-project/download/تقرير-مقارنة-الوثائق-بالمشروع-Ezz-OS.docx"
TMP = SRC + ".tmp"

with zipfile.ZipFile(SRC, "r") as z:
    names = z.namelist()
    files = {n: z.read(n) for n in names}

doc = files["word/document.xml"].decode("utf-8")

# 0) strip the cached hyperlink entry inside the TOC field paragraph itself
#    (docx-js emits one cached entry with an empty PAGEREF result -> renders as a duplicate line)
paras = re.findall(r"<w:p\b[^>]*>.*?</w:p>", doc, re.S)
removed = 0
for p in paras:
    if "instrText" in p and re.search(r"<w:instrText[^>]*>\s*TOC\b", p):
        new_p, n = re.subn(r"<w:hyperlink\b.*?</w:hyperlink>", "", p, flags=re.S)
        if n:
            doc = doc.replace(p, new_p, 1)
            removed += n
print("removed cached TOC field entries:", removed)

# 1) remove empty pgNumType (docx-js emits it for the cover section)
doc = doc.replace("<w:pgNumType/>", "")

# 2) determine footer order: footerReference rIds in document order
rids = re.findall(r'<w:footerReference w:type="default" r:id="(rId\d+)"', doc)
rels = files["word/_rels/document.xml.rels"].decode("utf-8")
rid2file = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="(footer\d+\.xml)"', rels))
footer_files = [rid2file[r] for r in rids if r in rid2file]
print("footer refs in doc order:", list(zip(rids, footer_files)))

# section order = [TOC(roman), body(arabic)] — cover has no footer
fmt_by_index = ["ROMAN", "arabic"]
for i, fname in enumerate(footer_files):
    key = "word/" + fname
    xml = files[key].decode("utf-8")
    fmt = fmt_by_index[i] if i < len(fmt_by_index) else "arabic"
    xml2, n = re.subn(
        r'(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)',
        r'\1 PAGE \\* ' + fmt + r' \\* MERGEFORMAT \2',
        xml)
    print(f"{fname}: patched {n} PAGE field(s) -> {fmt}")
    files[key] = xml2.encode("utf-8")

files["word/document.xml"] = doc.encode("utf-8")

with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as z:
    for n in names:
        z.writestr(n, files[n])
shutil.move(TMP, SRC)
print("FOOTER-PATCH-OK")

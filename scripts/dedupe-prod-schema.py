#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""تنظيف مخطط الإنتاج من الكتل المكررة — يُبقي آخر ظهور (الأحدث) لكل model/enum.
يحفظ نسخة احتياطية قبل الكتابة ويطبع الاختلافات بين النسخ المكررة."""
import re, shutil, sys, difflib

PATH = 'prisma/schema.production.prisma'
src = open(PATH).read()
lines = src.split('\n')

# تجزئة إلى كتل علوية المستوى
blocks = []  # (name, kind, [line_idx...], text)
i = 0
prologue = []  # أسطر قبل أول كتلة
current_extra = []  # أسطر غير مكتملة (تعليقات/فواصل) بين الكتل

start_re = re.compile(r'^(model|enum) (\w+) \{')

while i < len(lines):
    m = start_re.match(lines[i])
    if m:
        kind, name = m.group(1), m.group(2)
        j = i
        while j < len(lines) and lines[j] != '}':
            j += 1
        j = min(j + 1, len(lines))  # شامل الإغلاق
        # تعليقات /// فوق الكتلة تخصها
        k = i
        while k > 0 and (lines[k-1].startswith('///') or (lines[k-1].startswith('//') and not lines[k-1].startswith('///'))):
            k -= 1
        body = '\n'.join(lines[k:j]).rstrip()
        blocks.append({'name': name, 'kind': kind, 'body': body, 'extra': '\n'.join(current_extra)})
        current_extra = []
        i = j
    else:
        current_extra.append(lines[i])
        i += 1

# ملاحظة: أسطر ما بعد آخر كتلة تظل في current_extra الأخيرة
trailing_extra = current_extra

# كشف التكرارات + الاختلافات
seen = {}
dups_report = []
for b in blocks:
    key = b['name']
    if key in seen:
        diff = list(difflib.unified_diff(
            seen[key]['body'].split('\n'), b['body'].split('\n'),
            lineterm='', n=1))[:12]
        dups_report.append((key, 'IDENTICAL' if not diff else f'DIFF ({len(diff)} سطر فرق)'))
        # نُبقي الأحدث (اللاحق)
        seen[key] = b
    else:
        seen[key] = b

print(f"كتل قبل: {len(blocks)}  بعد إزالة التكرار: {len(seen)}")
diff_names = [r for r in dups_report if r[1] != 'IDENTICAL']
print(f"مكررات متطابقة نصياً: {len(dups_report) - len(diff_names)}   فيها فروق: {len(diff_names)}")
for name, status in diff_names:
    print(f"  ⚠ {name}: {status}  ← اعتُمدت النسخة الأحدث")

# إعادة البناء: ترتيب أول ظهور مع أحدث نص
order = []
for b in blocks:
    if b['name'] not in order:
        order.append(b['name'])

out_parts = ['\n'.join(l for l in prologue if l.strip())]
for name in order:
    b = seen[name]
    if b['extra'].strip():
        out_parts.append(b['extra'].strip())
    out_parts.append(b['body'])
if any(l.strip() for l in trailing_extra):
    # تجاهل أسطر متكررة ما بعد آخر كتلة إن كانت مجرد فراغات/فواصل
    txt = '\n'.join(trailing_extra).strip()
    if txt:
        out_parts.append(txt)

out = '\n\n'.join(p for p in out_parts if p.strip()) + '\n'

shutil.copy(PATH, PATH + '.bak')
open(PATH, 'w').write(out)
n_models = len(re.findall(r'^model ', out, re.M))
n_enums = len(re.findall(r'^enum ', out, re.M))
print(f"✅ كُتب {PATH} — models={n_models} enums={n_enums} (نسخة احتياطية: .bak)")

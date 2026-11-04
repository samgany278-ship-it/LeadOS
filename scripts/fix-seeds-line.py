#!/usr/bin/env python3
"""إصلاح سطر seeds المكسور في src/lib/discovery.ts — مع إعادة محاولة ضد رفرفة الملفات"""
import hashlib, io, sys, time

PATH = "/home/z/my-project/src/lib/discovery.ts"
BROKEN = b"const seeds = [shape.seedsour % shape.seeds.length], shape.seeds[(hour + 1) % shape.seeds.length]]"
FIXED = b"const seeds = [shape.seeds[hour % shape.seeds.length], shape.seeds[(hour + 1) % shape.seeds.length]]"

for attempt in range(1, 6):
    data = open(PATH, "rb").read()
    if FIXED in data and BROKEN not in data:
        print(f"attempt {attempt}: already fixed")
        sys.exit(0)
    if BROKEN not in data:
        print(f"attempt {attempt}: broken line not found (flap?) — retrying...")
        time.sleep(1)
        continue
    ndata = data.replace(BROKEN, FIXED, 1)
    tmp = PATH + ".tmp"
    with open(tmp, "wb") as f:
        f.write(ndata)
        f.flush()
    import os
    os.replace(tmp, PATH)
    # تحقق
    check = open(PATH, "rb").read()
    if FIXED in check and BROKEN not in check:
        print(f"attempt {attempt}: FIXED ok, md5={hashlib.md5(check).hexdigest()}")
        sys.exit(0)
    time.sleep(1)
print("FAILED after 5 attempts")
sys.exit(1)

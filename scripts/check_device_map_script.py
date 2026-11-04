#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Validate Ezz-Device-Map.ps1 for PS 5.1 compatibility:
1. Add UTF-8 BOM (required by PS 5.1 to read Arabic strings correctly)
2. Check brace/paren/bracket balance outside strings & comments
3. Detect PS7-only syntax (??, ?., &&, ||, ternary ?:)
4. Confirm BAT file has NO BOM
"""
import re, sys, codecs

PS1 = "/home/z/my-project/download/Ezz-Device-Map.ps1"
BAT = "/home/z/my-project/download/Ezz-Device-Map.bat"

# ---------- 1) BOM handling ----------
with open(PS1, "rb") as f:
    raw = f.read()
if raw.startswith(codecs.BOM_UTF8):
    print("[BOM] PS1 already has UTF-8 BOM")
else:
    raw = codecs.BOM_UTF8 + raw
    with open(PS1, "wb") as f:
        f.write(raw)
    print("[BOM] UTF-8 BOM added to PS1  OK")

with open(BAT, "rb") as f:
    braw = f.read()
if braw.startswith(codecs.BOM_UTF8):
    print("[BOM] BAD: BAT has BOM — removing it (BOM breaks @echo off)")
    with open(BAT, "wb") as f:
        f.write(braw[len(codecs.BOM_UTF8):])
else:
    print("[BOM] BAT has no BOM  OK (correct for cmd.exe)")

# ---------- 2) Balance check (state machine over chars) ----------
text = raw.decode("utf-8-sig")
state = "code"   # code | dq | sq | comment | blockcomment
stack = []
pairs = {"}": "{", ")": "(", "]": "["}
openers = "{(["
closers = "})]"
line = 1
errors = []
i = 0
n = len(text)
while i < n:
    ch = text[i]
    nxt = text[i + 1] if i + 1 < n else ""
    if ch == "\n":
        line += 1
        if state == "comment":
            state = "code"
        i += 1
        continue
    if state == "code":
        if ch == "#" or (ch == "<" and nxt == "#"):
            state = "comment" if ch == "#" else "blockcomment"
            if ch == "<":
                i += 1
        elif ch == '"':
            state = "dq"
        elif ch == "'":
            state = "sq"
        elif ch in openers:
            stack.append((ch, line))
        elif ch in closers:
            if not stack or stack[-1][0] != pairs[ch]:
                errors.append(f"line {line}: unmatched '{ch}'")
                if stack: stack.pop()
            else:
                stack.pop()
    elif state == "dq":
        if ch == "`":      # backtick escape
            i += 1
        elif ch == '"':
            if nxt == '"':  # doubled quote escape
                i += 1
            else:
                state = "code"
    elif state == "sq":
        if ch == "'":
            if nxt == "'":
                i += 1
            else:
                state = "code"
    elif state == "blockcomment":
        if ch == "#" and nxt == ">":
            state = "code"
            i += 1
    i += 1

if stack:
    for ch, ln in stack:
        errors.append(f"line {ln}: unclosed '{ch}'")

if errors:
    print("[BALANCE] PROBLEMS FOUND:")
    for e in errors[:20]:
        print("   " + e)
else:
    print("[BALANCE] All braces/parens/brackets balanced  OK")

# ---------- 3) PS7-only syntax ----------
patterns = {
    r"\?\?": "null-coalescing ?? (PS7 only)",
    r"\?\.\w": "conditional access ?. (PS7 only)",
    r"&&": "pipeline chain && (PS7 only)",
    r"\|\|": "pipeline chain || (PS7 only)",
}
bad = False
for pat, msg in patterns.items():
    for ln_no, ln in enumerate(text.splitlines(), 1):
        stripped = ln.strip()
        if stripped.startswith("#"):
            continue
        if re.search(pat, ln):
            print(f"[PS7] BAD line {ln_no}: found {msg}  ->  {stripped[:80]}")
            bad = True
if not bad:
    print("[PS7] No PS7-only operators found  OK")

# ---------- 4) quick stats ----------
lines = text.count("\n") + 1
print(f"[INFO] PS1: {lines} lines, {len(raw)} bytes")
sys.exit(1 if (errors or bad) else 0)

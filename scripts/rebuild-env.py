#!/usr/bin/env python3
"""إعادة بناء .env من ملفات الكردنشلز الأصلية في upload/
(الساندبوكس بيمسح .env عند التدوير — ده السكربت الرسمي للاسترجاع، توثيق worklog BATCH-003/004)
المصادر:
  upload/مفتاح api بيشغل ديب سيك و جي ال ام و مني ماكس  → dahl_* (DAHL_API_KEY[_N])
  upload/api من انفيدا ل مودلات مجانيه                  → nvapi-* (NVIDIA_API_KEY[_N])
  upload/kaggle.txt                                      → KGAT_* (KAGGLE_API_TOKEN[_N])
  CRON_SECRET + CRON_SECRET_ALT                          → توليد عشوائي جديد (لو مش موجودين)
ملاحظة: لا يطبع أي قيمة مفتاح كاملة في الإخراج — أطوال وأول 8 حروف فقط.
"""
import os, re, secrets, sys

ROOT = "/home/z/my-project"
ENV_PATH = os.path.join(ROOT, ".env")
UP = os.path.join(ROOT, "upload")

def read(name: str) -> str:
    with open(os.path.join(UP, name), "r", encoding="utf-8", errors="ignore") as f:
        return f.read()

dahl_text = read("مفتاح api بيشغل ديب سيك و جي ال ام و مني ماكس")
nvidia_text = read("api من انفيدا ل مودلات مجانيه")
kaggle_text = read("kaggle.txt")

dahl_keys = re.findall(r"dahl_[A-Za-z0-9_\-]+", dahl_text)
dahl_keys = [k for k in dahl_keys if len(k) > 20]
nvidia_keys = re.findall(r"nvapi-[A-Za-z0-9_\-]+", nvidia_text)
kaggle_keys = re.findall(r"KGAT_[A-Za-z0-9_\-]+", kaggle_text)

# إزالة التكرار مع الحفاظ على الترتيب
def dedup(seq):
    seen, out = set(), []
    for x in seq:
        if x not in seen:
            seen.add(x); out.append(x)
    return out

dahl_keys, nvidia_keys, kaggle_keys = dedup(dahl_keys), dedup(nvidia_keys), dedup(kaggle_keys)

# الاحتفاظ بأي أسطر مفيدة موجودة حاليًا (DATABASE_URL مثلاً)
base_url = "https://inference.dahl.global/v1"
nv_url = "https://integrate.api.nvidia.com/v1"

lines = []
lines.append(f"DATABASE_URL=file:{ROOT}/db/custom.db")

# الأسرار الحالية إن وجدت وإلا توليد جديد
existing = {}
if os.path.exists(ENV_PATH):
    for ln in open(ENV_PATH, encoding="utf-8", errors="ignore"):
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", ln.strip())
        if m:
            existing[m.group(1)] = m.group(2)

cron = existing.get("CRON_SECRET") or secrets.token_hex(24)
cron_alt = existing.get("CRON_SECRET_ALT") or secrets.token_hex(24)
auth_secret = existing.get("AUTH_SECRET") or secrets.token_hex(24)

lines += [
    f"CRON_SECRET={cron}",
    f"CRON_SECRET_ALT={cron_alt}",
    f"AUTH_SECRET={auth_secret}",
    "",
    f"DAHL_BASE_URL={base_url}",
]
if dahl_keys:
    lines.append(f"DAHL_API_KEY={dahl_keys[0]}")
    for i, k in enumerate(dahl_keys):
        lines.append(f"DAHL_API_KEY_{i+1}={k}")
lines += [
    "",
    f"NVIDIA_BASE_URL={nv_url}",
]
if nvidia_keys:
    lines.append(f"NVIDIA_API_KEY={nvidia_keys[0]}")
    for i, k in enumerate(nvidia_keys):
        lines.append(f"NVIDIA_API_KEY_{i+1}={k}")
lines.append("")
if kaggle_keys:
    lines.append(f"KAGGLE_API_TOKEN={kaggle_keys[0]}")
    for i, k in enumerate(kaggle_keys):
        lines.append(f"KAGGLE_API_TOKEN_{i+1}={k}")
    lines.append("")
lines.append("EXPORT_DIR=download")

with open(ENV_PATH, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")

def brief(k):
    return f"{k[:8]}…({len(k)})"

print(f"OK: .env rebuilt — dahl={len(dahl_keys)} nvidia={len(nvidia_keys)} kaggle={len(kaggle_keys)}")
print(f"  dahl[0]={brief(dahl_keys[0]) if dahl_keys else '-'}")
print(f"  nvidia[0]={brief(nvidia_keys[0]) if nvidia_keys else '-'}")
print(f"  kaggle[0]={brief(kaggle_keys[0]) if kaggle_keys else '-'}")
print(f"  CRON_SECRET: {'موجود من قبل' if existing.get('CRON_SECRET') else 'توليد جديد'} (len={len(cron)})")

#!/usr/bin/env python3
"""استرجاع «الجهاز الأساسي» LeadOS من Kaggle — بعد أي تدوير ساندبوكس جديد.

الاستخدام:
  python3 scripts/restore-from-kaggle.py            # استرجاع كامل
  python3 scripts/restore-from-kaggle.py --dry-run  # من غير كتابة

المتطلبات: توكن Kaggle في متغير البيئة KAGGLE_API_TOKEN
  (متاح في داتاسيت leados-main نفسه أو من المالك)
الآلية:
  1) تنزيل الداتاسيت الخاصة ezz22551/leados-main (المشروع كامل + git bundle + db + .env)
  2) فك المحتوى فوق /home/z/my-project/download/Ezz-LeadOS-project-final
  3) استعادة تاريخ git من leados-repo.bundle داخل /home/z/my-project/.git
  4) طباعة خطوات ما بعد الاسترجاع (prisma generate + skills + dev)
"""
import os, subprocess, sys, zipfile, glob

DS = "ezz22551/leados-main"
PROJECT = "/home/z/my-project/download/Ezz-LeadOS-project-final"
GIT_ROOT = "/home/z/my-project"
DL = "/tmp/leados-restore"
DRY = "--dry-run" in sys.argv

def run(cmd, **kw):
    print("$", " ".join(cmd))
    if DRY:
        return 0
    r = subprocess.run(cmd, **kw)
    if r.returncode != 0:
        print("!! فشل:", " ".join(cmd)); sys.exit(1)
    return r.returncode

os.makedirs(DL, exist_ok=True)
# تنزيل الداتاسيت (kaggle CLI يتطلب التوكن في KAGGLE_API_TOKEN أو ~/.kaggle/access_token)
run(["kaggle", "datasets", "download", DS, "-p", DL, "--unzip"])

# فك الأرشيفات المضغوطة للمجلدات (dir-mode zip)
for z in glob.glob(os.path.join(DL, "*.zip")):
    print("فك:", os.path.basename(z))
    if not DRY:
        with zipfile.ZipFile(z) as f:
            f.extractall(DL)

# نقل الشجرة فوق المشروع
run(["rsync", "-a", "--exclude=dataset-metadata.json", DL + "/", PROJECT + "/"])

# استعادة git من الـbundle
bundle = os.path.join(DL, "leados-repo.bundle")
if os.path.exists(bundle):
    os.makedirs(os.path.join(GIT_ROOT, ".git"), exist_ok=True)
    run(["git", "-C", GIT_ROOT, "fetch", "--all", bundle])

print("""
✅ الاسترجاع خلص. الخطوات التالية (تشغيلها يدوياً):
   cd /home/z/my-project/download/Ezz-LeadOS-project-final
   bunx prisma generate
   python3 scripts/rebuild-discovery-skills.py   # لو skills/discovery ناقصة
   bun run skills:gen
   bun run dev                                   # السيرفر على :3000
   bash scripts/verify-e2e.sh
""")

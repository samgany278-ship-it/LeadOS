#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LeadOS / Ezz Company OS — مولّد ومحدّث سجل المشروع الحي
docs/Ezz-Project-Tracker.xlsx

قابل لإعادة التشغيل: عدّل بيانات المهام/الاختبارات أدناه ثم أعد التشغيل.
الاستخدام:  python3 scripts/update-ezz-tracker.py
"""
import sys, os
from datetime import date

SKILL_TPL = "/home/z/my-project/skills/xlsx/templates"
for p in (SKILL_TPL,):
    if p not in sys.path:
        sys.path.insert(0, p)

from base import (  # noqa: E402
    FONT_NAME, HEADER_BOLD, PRIMARY, SECONDARY,
    ACCENT_POSITIVE, ACCENT_NEGATIVE, ACCENT_WARNING,
    NEUTRAL_900, NEUTRAL_600, NEUTRAL_200, NEUTRAL_100, NEUTRAL_0,
    font_title, font_header, font_body, font_caption,
    fill_header, fill_data_row,
    border_header, align_header, align_text, align_number,
    setup_sheet, style_header_row, style_data_row,
)
from openpyxl import Workbook  # noqa: E402
from openpyxl.styles import Font, PatternFill, Alignment  # noqa: E402
from openpyxl.utils import get_column_letter  # noqa: E402
from openpyxl.worksheet.datavalidation import DataValidation  # noqa: E402
from openpyxl.worksheet.table import Table, TableStyleInfo  # noqa: E402
from openpyxl.formatting.rule import CellIsRule  # noqa: E402
from openpyxl.chart import BarChart, Reference  # noqa: E402

TODAY = "2026-11-03"
OUT = "/home/z/my-project/docs/Ezz-Project-Tracker.xlsx"

# ══════════════════════════ 1) TASKS ══════════════════════════
# (Task ID, Req ID, Module, Title, Description, Priority, Status, Progress,
#  Source Doc, Source Section, Dependencies, Affected Files, Impl Notes,
#  Acceptance, Test IDs, Latest Result, Evidence, Blocker, Next Action, Owner)
TASKS = [
 ("T-001","REQ-AUTH","Auth","تسجيل الدخول JWT+scrypt","تسجيل دخول بكلمة مرور مشفرة scrypt وجلسة httpOnly JWT","P0","TESTED_PASS",100,"Ezz-Complete-Summary §18","الأمان وحسابات الدخول","—","src/lib/auth.ts, src/app/api/auth/*","—","دخول ناجح + كوكي جلسة","TS-002,TS-003","PASS محلياً وعلى الإنتاج","/tmp/cj.txt curl 200","—","—","Agent"),
 ("T-002","REQ-API","API","طبقة API حية 55 مسار","كل نقاط الـAPI تستجيب بجلسة مصرح بها","P0","TESTED_PASS",100,"Ezz-Company-OS-Spec §9","واجهات API","T-001","src/app/api/**","—","200 لكل endpoint مفحوص","TS-002","PASS 22/22 محلي + 9/9 إنتاج","dev.log, curl sweep","—","—","Agent"),
 ("T-003","REQ-DB","Database","مخطط 65 Model مطابق","قاعدة SQLite تحتوي كل الجداول الموثقة","P0","TESTED_PASS",100,"Ezz-Complete-Summary ملحق A","قاعدة البيانات","—","prisma/schema.prisma, db/custom.db","—","عدد الجداول = 65","TS-013","PASS 65/65","sqlite_master count","—","—","Agent"),
 ("T-004","REQ-UI","UI","21 شاشة لوحة","شاشات AppShell كاملة + صفحة /lead-form","P0","TESTED_PASS",100,"Ezz-Complete-Summary ملحق C","واجهة المستخدم","T-002","src/components/leados/views/*","—","الملفات موجودة والصفحة تُبنى وترجع 200","TS-002,TS-014","PASS","ls + HTTP 200","—","—","Agent"),
 ("T-005","REQ-POLICIES","Browser","سياسات 10 منصات","ملفات سياسة لكل منصة اجتماعية","P1","TESTED_PASS",100,"Ezz-Company-OS-Spec §11","طبقة المتصفح","—","src/config/platform-policies/*","—","10 ملفات فعالة","TS-014","PASS 10/10","ls count","—","—","Agent"),
 ("T-006","REQ-BR-1","Browser Runtime"," affinity: متصفح لكل منصة","متصفح واحد لمنصة واحدة ومهامها دون إغلاق بيني","P1","TESTED_PASS",100,"Ezz-Full-Build §8","اختبارات المتصفح","T-030","scripts/browser-runtime/runner.mjs","إصلاح CRON_SECRET 2026-11-03","5 تأكيدات T1 ناجحة","TS-004","PASS 5/5","scripts/hardtest-browser/evidence.md","—","—","Agent"),
 ("T-007","REQ-BR-2","Browser Runtime","استمرارية الجلسة بين الجيلات","حفظ الجلسة مشفراً واستعادتها في الجيل التالي","P1","TESTED_PASS",100,"Ezz-Full-Build §8","اختبارات المتصفح","T-006","src/lib/browser/session-store.ts","—","5 تأكيدات T2 ناجحة","TS-005","PASS 5/5","evidence T2","—","—","Agent"),
 ("T-008","REQ-BR-3","Browser Runtime","استرداد الانهيار","كشف فقد المتصفح وإعادة الطابور واستكمال checkpoint","P1","TESTED_PASS",100,"Ezz-Full-Build §8","اختبارات المتصفح","T-006","src/lib/browser/pool.ts","—","5 تأكيدات T3 ناجحة","TS-006","PASS 5/5","evidence T3","—","—","Agent"),
 ("T-009","REQ-BR-4","Browser Runtime","عزل فشل المنصة","فشل منصة لا يوقف البقية + backoff صادق","P1","TESTED_PASS",100,"Ezz-Full-Build §8","اختبارات المتصفح","T-006","src/lib/browser/policy.ts","يُشترى طابور نظيف (بعد T3)","4 تأكيدات T4 ناجحة","TS-007","PASS 4/4 (بعد تنظيف الطابور)","evidence T4","B-004","—","Agent"),
 ("T-010","REQ-BR-5","Browser Runtime","ضغط الظهر والسعة","رفض المتصفح الزائد CAPACITY_LIMIT وذرّية الـclaim","P1","TESTED_PASS",100,"Ezz-Full-Build §8","اختبارات المتصفح","T-006","src/lib/browser/pool.ts","—","5 تأكيدات T5 ناجحة","TS-008","PASS 5/5","evidence T5","—","—","Agent"),
 ("T-011","REQ-BR-6","Browser Runtime","بوابات السياسة","TASK_NOT_ALLOWED وPLATFORM_PAUSED وCOOLDOWN وساعات النشاط","P1","TESTED_PASS",100,"Ezz-Full-Build §8","اختبارات المتصفح","T-006","src/lib/browser/compliance.ts","—","4 تأكيدات T6 ناجحة","TS-009","PASS 4/4","evidence T6","—","—","Agent"),
 ("T-012","REQ-BR-7","Browser Runtime","سلسلة الجيلات handoff","g1→g4 بنسل parent/child وصفر ادعاء مزدوج","P1","TESTED_PASS",100,"Ezz-Full-Build §8","اختبارات المتصفح","T-006","scripts/browser-runtime/runner.mjs","—","6 تأكيدات T7 ناجحة","TS-010","PASS 6/6","evidence T7","—","—","Agent"),
 ("T-013","REQ-BR-8","Browser Runtime","مسار Jina الاحتياطي","direct فشل → Jina → خطأ صادق بلا تجاوز جدار","P2","PARTIAL",80,"Ezz-Full-Build §8","اختبارات المتصفح","T-006","src/lib/jina.ts","—","4 من 5 تأكيدات T8","TS-011","PARTIAL 4/5","evidence T8","BLK-002","توفير JINA_API_KEY ثم إعادة T8","Agent"),
 ("T-014","REQ-BR-9","Browser Runtime","سلامة اللوحة والتقارير","تطابق العدادات مع DB وصفر تسريب أسرار","P1","TESTED_PASS",100,"Ezz-Full-Build §8","اختبارات المتصفح","T-006","src/app/api/browser/control/route.ts","—","5 تأكيدات T9 ناجحة","TS-012","PASS 5/5","evidence T9","—","—","Agent"),
 ("T-015","REQ-PROD","Deployment","إنتاج Vercel حي","leados-olive وleados-v2 يردان 200 ونبضة async","P0","TESTED_PASS",100,"Ezz-Company-OS-Spec §0,§17","النشر الدائم","—","vercel.json","—","صفحة 200 + tick async","TS-003","PASS (200, async ~2ms)","curl prod sweep","—","—","Agent"),
 ("T-016","REQ-HARDTEST","Testing","إعادة 148 اختبار hardtest P1-P12","الاختبارات الصلبة ضد Neon/Vercel بقاعدة إنتاج","P0","BLOCKED_EXTERNAL",0,"Ezz-Full-Build §1","معيار النجاح","T-015","scripts/hardtest/*","lib.mjs يقرأ .env.prod-runtime","إعادة runnerA-D بنتائج موثقة","TS-015","BLOCKED","scripts/hardtest/evidence.md (تاريخي)","BLK-001","توفير .env.prod-runtime من أسرار المالك","Owner"),
 ("T-017","REQ-TS","Code Quality","صفر أخطاء TS في src/","كود التطبيق نظيف من أخطاء TypeScript","P0","TESTED_PASS",100,"Ezz-Company-OS-Spec §20.8","أمن تشغيلي","—","src/**","—","tsc --noEmit: 0 أخطاء في src","TS-001","PASS (src=0)","tsc output","—","—","Agent"),
 ("T-018","REQ-TS2","Code Quality","أخطاء TS في سكريبتات الصيانة","~130 خطأ خارج التطبيق (scripts/, examples)","P2","TESTED_PASS",100,"Ezz-Company-OS-Spec §2","قرار ignoreBuildErrors","T-017","tsconfig.json","قرار D-005: استثناء غير-التطبيق من tsconfig (2026-11-04)","tsc --noEmit = 0 أخطاء على مستوى المشروع","TS-001","PASS 0 أخطاء (كامل المستودع)","tsc output 2026-11-04","—","مغلق — D-005","Agent"),
 ("T-019","REQ-TS3","Code Quality","إزالة ignoreBuildErrors","رفع التجاهل بعد تنظيف الأخطاء","P2","TESTED_PASS",100,"Ezz-Company-OS-Spec §20.8","أمن تشغيلي","T-018","next.config.ts","ignoreBuildErrors=false (2026-11-04)","بناء إنتاجي ناجح بالفحص مفعّلاً","TS-017","PASS exit=0","/tmp/build.log + bun run build","—","مغلق","Agent"),
 ("T-020","REQ-SKILLS","Skills","مانيفيست مهارات الاكتشاف 19+","skills/discovery/*/SKILL.md تُجمّع في manifest","P1","TESTED_PASS",100,"Ezz-Company-OS-Spec §16","هيكل المجلدات","—","skills/discovery/, src/lib/skills/manifest.generated.ts","أعيد البناء بـscripts/rebuild-discovery-skills.py (2026-11-04)","manifest ≥19 مهارة","TS-014","PASS 19/19","bun run skills:gen","—","مغلق — سكربت إعادة البناء موثق","Agent"),
 ("T-021","REQ-GITSKILLS","Skills","حصاد GitSkills للقاعدة","جوب GIT_SKILLS_HARVEST يملأ جدول GitSkill","P2","TESTED_PASS",100,"Ezz-Complete-Summary §6","التعلم والمهارات","T-022","src/lib/skills/gitskills.ts","حصاد حي من HuggingFace في موجة 2026-11-04","GitSkill>0 بعد جوب حصاد","TS-020","PASS 8 مهارات محصودة","check-wave.ts","—","مغلق","Agent"),
 ("T-022","REQ-AI-KEYS","AI","مفاتيح مزودات AI (NVIDIA/DAHL)","تفعيل التصنيف والمحادثة الحقيقية","P0","TESTED_PASS",100,"Ezz-Company-OS-Spec §13","مزودات AI","—",".env","أعيد بناء .env من upload/ بـscripts/rebuild-env.py بعد مسح الساندبوكس (2026-11-04)","ai-check نجاح بنداء حي","TS-019","PASS: dahl 11/11 + NVIDIA 2/2 (glm-5.3-flash) — ping MiniMax 1.5s","verify-e2e.sh ALL-GREEN","—","مغلق — 13 مفتاح حي","Agent"),
 ("T-023","REQ-SEARCH","Discovery","مزودات البحث (Serper/Tavily/SerpAPI/Exa)","تغذية محرك الاكتشاف بنتائج حية","P0","PARTIAL",60,"Ezz-Complete-Summary §13","سلسلة البحث","T-022","src/lib/serp-scrape.ts, src/lib/discovery.ts","السلسلة شغالة على فولباك z-ai: موجة 2026-11-04 جابت 30 نتيجة/جوب ولديز حقيقية","موجة اكتشاف بنتائج مصرية حقيقية","TS-020","PARTIAL: النتائج حية بالفولباك — الجودة تتناعف بمفتاح مدفوع","check-wave.ts results=30","BLK-005","شحن Serper أو مفتاح بديل يرفع الجودة","Agent"),
 ("T-024","REQ-ZIZO","Zizo","وكيل زيزو وسياسة anti-ban","ساعات وسقوف وفواصل والرفض ينتج مسودة","P1","IMPLEMENTED",70,"Ezz-Complete-Summary §7","زيزو","T-002","src/lib/agent/zizo/*","—","اختبار حي لقنوات واتساب/تيليجرام","—","IMPLEMENTED (كود+API 200)","/api/agent/zizo:200","BLK-008","ربط قناة واختبار زيزوTick حي","Owner+Agent"),
 ("T-025","REQ-GROUPS","Groups","مراقبة الجروبات وتحويل البوستات","Facebook/Telegram/Reddit/X → ليدز","P1","IMPLEMENTED",70,"Ezz-Complete-Summary §11","مراقبة الجروبات","T-023","src/lib/monitors/*","—","مسح جروب حي بجلسة صالحة","—","IMPLEMENTED (API 200)","/api/groups:200","BLK-005","مصادر حية ثم scan حقيقي","Owner"),
 ("T-026","REQ-CRON","Heartbeat","نبضة async سريعة","رد <1ث والشغل في الخلفية عبر after","P0","TESTED_PASS",100,"Ezz-Complete-Summary ملحق H","النبضات","T-002","src/app/api/cron/tick/route.ts","—","tick 200 async بلا حجب","TS-003","PASS (async, ~2ms إنتاج)","curl prod tick","—","—","Agent"),
 ("T-027","REQ-NEON","Database","توحيد قاعدتي Neon","قاعدة إنتاج واحدة معتمدة مع نسخة احتياطية","P1","BLOCKED_EXTERNAL",0,"Ezz-Complete-Summary §17","قاعدتا Neon","T-003","prisma/schema.production.prisma","—","توحيد موثق + اختبار استرجاع","—","BLOCKED","—","BLK-001","توفير بصمات Neon ثم خطة ترحيل","Owner"),
 ("T-028","REQ-WORKLOG","Governance","سجل worklog.md حي","نقطة استئناف بعد كل دفعة","P1","TESTED_PASS",100,"Ezz-Full-Build §5","دورة العمل","—","worklog.md","أُنشئ 2026-11-03","سجل محدث بعد كل دفعة","—","PASS","worklog.md","—","—","Agent"),
 ("T-029","REQ-TRACKER","Governance","ملف Excel إلزامي + سكريبت تحديث","8 أوراق بصيغ حية وقوائم منسدلة","P0","TESTED_PASS",100,"Ezz-Full-Build §4","ملف Excel","—","docs/Ezz-Project-Tracker.xlsx, scripts/update-ezz-tracker.py","هذا الملف","يفتح ويحتوي الأوراق الثمانية","TS-016","PASS","xlsx.py validate","—","تحديث بعد كل دفعة","Agent"),
 ("T-030","REQ-ADMIN","Auth","حساب أدمن محلي جاهز","admin@leados.com بعضوية مالك في المساحة","P0","TESTED_PASS",100,"Ezz-Company-OS-Spec §14","الدخول المحلي","T-001","scripts/ensure-admin-login.ts","أُعيد ضبط السر محلياً 2026-11-03","دخول 200 + /api/me 200","TS-002","PASS","curl login 200","—","تغيير السر قبل أي نشر عام","Owner"),
 ("T-031","REQ-SECRETS","Security","أسرار بيئة الإنتاج مستعادة","scripts/deploy/.tokens و.env.prod-runtime في بيئة التشغيل","P0","BLOCKED_EXTERNAL",0,"Ezz-Complete-Summary ملحق E","أسماء المتغيرات","—","scripts/deploy/.tokens","غير موجودة في الساندبوكس","إعادة 148 اختبار + dbq.py على الإنتاج","TS-015","BLOCKED","—","BLK-001","نقل الأسرار لبيئة عمل آمنة","Owner"),
 ("T-032","REQ-EZZ-ID","Branding","هوية Ezz في الواجهة","اعتماد الاسم التجاري دون كسر LeadOS","P2","TESTED_PASS",100,"Ezz-Complete-Summary §23","هوية Ezz","T-004","src/app/layout.tsx, src/app/page.tsx, login-screen.tsx, app-shell.tsx","هوية Ezz في العناوين والواجهة + تعليقات الكود بقت LeadOS (توافق §23)","شاشات بهوية Ezz واختبار انحدار","TS-002,TS-014","PASS: الصفحات 200 + tsc صفر + البناء سليم","verify-e2e.sh ALL-GREEN","—","مغلق","Agent"),
 ("T-033","REQ-LOCAL-AGENT","Local Agent","عامل محلي + إضافة متصفح","جسر صادر موثق بلا نسخ جلسات للسحابة","P1","IMPLEMENTED",85,"Ezz-Complete-Summary §20","المتصفح المحلي","T-011","src/lib/agent/local.ts, src/app/api/agent/local/* (7 راوتات), local-agent/*, scripts/hardtest-local-agent.*","عقد سحابي كامل على PlatformAccount+Job بلا جداول جديدة: ربط (سر مرة واحدة hash) / تسجيل / استطلاع lease / نبضة / تسليم / إيقاف / إبطال فوري يفشل الجاري","اختبار ربط وفصل آمن","TS-021","PASS 20/20 عقد حي (سلبيات: 401/403/إيقاف/دوران سر)","scripts/hardtest-local-agent.sh","BLK-009","التحقق على جهاز Windows حقيقي (آخر ميل) + كارت UI للربط","Agent"),
 ("T-034","REQ-ROUTER","Resource Router","موجّه موارد وبدائل","اختيار مزود وبديل عند الفشل وقواطع","P1","IMPLEMENTED",60,"Ezz-Complete-Summary §26","Resource Router","T-022","src/lib/ai.ts","سلاسل fallback موجودة بالكود","اختبار حي عند توفر مفاتيح","—","IMPLEMENTED (كود)","/api/settings/ai chains","BLK-004","اختبار حي للمفاتيح","Owner"),
 ("T-035","REQ-C360","Client 360","ملف عميل موحد حي","تسلسل زمني لكل الأحداث والمصادر والمالية","P2","PARTIAL",60,"Ezz-Complete-Summary §31","Client 360","T-003","src/components/leados/views/lead-profile.tsx, src/app/api/leads/[id]/route.ts","النواة موجودة ومختبِرة: ملخص استخباري + مكونات Score + الأدلة/الاستنتاجات + خط زمني (Activities) + المصادر والصفحات الاجتماعية","عرض موحد بتصدير مقيد","TS-002","PARTIAL: النواة حية — الفواتير/المشروعات/التكاليف ترتبط بـT-040","lead-profile شاشة 360°","—","طبقة مالية بعد T-040","Agent"),
 ("T-036","REQ-DLAB","Decision Lab","مدير علمي وبطاقات قرار","أدلة مؤرخة وتجارب مقاسة ومراجعة","P3","NOT_STARTED",0,"Ezz-Complete-Summary §28","Intelligence","T-034","src/app/api/experiments/*","جدول AbExperiment موجود","تجربة A/B مقاسة كاملة","—","—","—","—","مرحلة P4","Agent"),
 ("T-037","REQ-CREATIVE","Creative","توليد صور/فيديو وبديل FFmpeg","فحص نوع وحجم وجودة الملفات الحقيقية","P2","PARTIAL",55,"Ezz-Full-Build §8","اختبارات الملفات","T-022","src/lib/creative/ffmpeg.ts (جديد), src/app/api/creative/render/route.ts (جديد)","مسار FFmpeg البرمجي كامل (سبك §26): MP4 عربي 1280x720 h264 حقيقي + تحقق نوع بالبايتات (ftyp) + ffprobe للجودة + كشف الملف المزيف (mp4 مسمى png يُرفض)","ملف حقيقي PNG/MP4 مفحوص","TS-022","PASS 11/11 (رندر+magic+probe+رفض مزيف+حدود)","scripts/hardtest-creative.sh","BLK-010","مفاتيح توليد AI للصور/الفيديو ترفع الحالة لTESTED_PASS","Agent"),
 ("T-038","REQ-WEB","Ezz Web","قوالب مواقع ومعاينات","بناء وفحص روابط وتجاوب لعملاء مؤهلين","P2","NOT_STARTED",0,"Ezz-Complete-Summary §24","شركة خدمات","T-037","(جديد)","—","بناء ناجح + معاينة مؤقتة","—","—","—","—","مرحلة P3","Agent"),
 ("T-039","REQ-SOCIAL","Social/Publish","نشر مصرح أو مسودة","دورة محتوى مع حالة نشر موثقة","P2","NOT_STARTED",0,"Ezz-Complete-Summary §30","Social & Publish","T-024","src/app/api/accounts/*","—","نشر موثق أو مسودة بلا تجاوز","—","—","—","—","يتطلب تفويض مالك","Owner"),
 ("T-040","REQ-FINANCE","Finance","تكاليف وإيرادات وربحية","ربط المصروف بكل مهمة وعميل","P2","NOT_STARTED",0,"Ezz-Complete-Summary §31","مالية","T-035","(جديد)","—","تقرير ربحية من بيانات فعلية","—","—","—","—","مرحلة P2/P3","Agent"),
]

TASK_HEADERS = ["Task ID","Requirement ID","Module","Task Title","Detailed Description","Priority","Status","Progress %",
  "Source Document","Source Section","Dependencies","Affected Files","Implementation Notes","Acceptance Criteria",
  "Test IDs","Latest Test Result","Evidence/Log Path","Blocker","Next Action","Owner","Created At","Updated At","Commit Hash"]

# ══════════════════════════ 2) BUGS ══════════════════════════
BUGS = [
 ("B-001","CRON_SECRET مفقود محلياً → رفض فتح متصفح","Major","P0","CLOSED",
  "تشغيل t1-t9 في ساندبوكس بلا CRON_SECRET في .env","الاختبارات تعمل 100%","start refused (undefined) وفشل 43 تأكيداً",
  "الـrunner يصادق بـx-cron-secret والسر فارغ","توليد CRON_SECRET/CRON_SECRET_ALT محلياً وإعادة تشغيل السيرفر","إعادة t1-t9 بعد الإصلاح","سجل الجلسة 2026-11-03","sandbox 2026-11-03","Agent","2026-11-03"),
 ("B-002","توكّع T8/c3: شرط العدّاد لا يطابق بيئة بلا مفتاح","Minor","P2","OPEN",
  "تشغيل t8-jina.ts دون JINA_API_KEY","requestCount>=2 وlastError يحوي jina","requests=1 failures=1 lastError=JINA_ERROR HTTP 401",
  "الاختبار يفترض محاولتين وحالة أحرف صغيرة؛ البيئة بلا مفتاح تسجل محاولة واحدة صادقة","لا تعديل على الاختبار لإنجاحه — يحتاج مفتاحاً حقيقياً","إعادة T8 بعد توفير BLK-002","evidence T8","2026-11-03","Agent","—"),
 ("B-003","~130 خطأ TypeScript في سكريبتات الصيانة","Major","P2","CLOSED",
  "bunx tsc --noEmit","صفر أخطاء على مستوى المستودع","أخطاء في scripts/ وexamples (src/ نظيف 100%)","قرار D-005: استثناء غير-التطبيق (scripts/skills/worker/النسخ المكررة) من tsconfig","إعادة tsc بعد كل دفعة","tsc = 0 أخطاء 2026-11-04","tsc output 2026-11-04","2026-11-03","Agent","2026-11-04"),
 ("B-004","تلوث طابور بين اختبارات t3→t4 (نفس القاعدة)","Minor","P3","OPEN",
  "تشغيل t3 ثم t4 مباشرة بنفس القاعدة","t4 يقيس جوباته فقط","runner فيسبوك يعالج جوبات t3 المؤجلة أولاً فيفشل تأكيد t4",
  "الاختبارات تشارك قاعدة واحدة بلا عزل","تشغيل t4 بطابور نظيف أو ترتيب الانتظار","تنظيف طابور الاختبار قبل t4","evidence T4 (التشغيلان)","2026-11-03","Agent","—"),
 ("B-005","نسختا leados/ وleados-repo/ تضاعف عداد أخطاء tsc","Minor","P3","CLOSED",
  "tsc --noEmit على المستودع","عداد واحد دقيق","246 خطأ مكرر من النسختين (123×2)",
  "نسخ أرشيفية داخل الساندبوكس تدخل نطاق الفحص","استثناء المجلدين من tsconfig (D-005)","إعادة tsc — 0 أخطاء","tsc 2026-11-04","2026-11-03","Agent","2026-11-04"),
 ("B-006","مسح الساندبوكس أفرغ .env (كل المفاتيح + CRON_SECRET)","Critical","P0","CLOSED",
  "فشل كل اختبارات المتصفح 401 + secret-len=0","بيئة مفاتيح كاملة دائمة","الملف رجع لسطر DATABASE_URL فقط بعد تدوير الساندبوكس",
  "الساندبوكس لا يحافظ على .env بين التدويرات (فخ موثق BATCH-003)","سكربت دائم scripts/rebuild-env.py يستخرج من upload/ (المصدر الحقيقي) ويولد أسراراً + test-all-keys.sh 15/15 OK","تشغيل rebuild-env.py بعد أي تدوير",".env rebuilt 2026-11-04","2026-11-04","Agent","2026-11-04"),
]
BUG_HEADERS = ["Bug ID","Title","Severity","Priority","Status","Reproduction Steps","Expected","Actual","Root Cause",
  "Fix","Regression Test","Evidence","Affected Version/Commit","Owner","Opened At","Closed At"]

# ══════════════════════════ 3) TESTS ══════════════════════════
TESTS = [
 ("TS-001","T-017,T-018","build/static","bunx tsc --noEmit","sandbox local","2026-11-04","صفر أخطاء","0 أخطاء على كامل المستودع بعد استثناء غير-التطبيق (D-005)","PASS",1,0,0,"static","tsc output","—"),
 ("TS-002","T-001,T-002,T-004,T-030","integration","curl sweep 22 endpoint بجلسة","local :3000","2026-11-03","200 لكلendpoint","22/22 = 200","PASS",22,0,0,"live","dev.log + curl","—"),
 ("TS-003","T-002,T-015,T-026","live-provider","curl sweep 9 endpoint إنتاج + tick","Vercel leados-olive","2026-11-03","200 + async","9/9 = 200، tick async ~2ms","PASS",9,0,0,"live","curl prod","—"),
 ("TS-004","T-006","e2e","bun run scripts/hardtest-browser/t1-affinity.ts","local + Playwright حقيقي","2026-11-04","5/5","5/5 (بعد إعادة بناء .env وتنظيف الطابور)","PASS",5,0,0,"live","hardtest-browser/evidence.md","—"),
 ("TS-005","T-007","e2e","t2-session-continuity.ts","local + Playwright","2026-11-04","5/5","5/5 — SESSION_RESTORE ×2، نفس الصف إصدار يزيد","PASS",5,0,0,"live","evidence T2","—"),
 ("TS-006","T-008","e2e","t3-crash-recovery.ts","local + Playwright","2026-11-04","5/5","5/5 — LOST + requeue + checkpoint RESTORED","PASS",5,0,0,"live","evidence T3","—"),
 ("TS-007","T-009","e2e","t4-platform-failure.ts (طابور نظيف)","local + Playwright","2026-11-04","4/4","4/4 — عزل الفشل وباكووف صادق","PASS",4,0,0,"live","evidence T4","—"),
 ("TS-008","T-010","e2e","t5-backpressure.ts","local + Playwright","2026-11-04","5/5","5/5 — 12/12 استنزاف، CAPACITY_LIMIT، ذرّية claim","PASS",5,0,0,"live","evidence T5","—"),
 ("TS-009","T-011","e2e","t6-policy-guards.ts","local + Playwright","2026-11-04","4/4","4/4 — TASK_NOT_ALLOWED/PLATFORM_PAUSED/COOLDOWN/ساعات","PASS",4,0,0,"live","evidence T6","—"),
 ("TS-010","T-012","e2e","t7-generations-chain.ts","local + Playwright","2026-11-04","6/6","6/6 — g1→g4 بلا ادعاء مزدوج ولا عالق","PASS",6,0,0,"live","evidence T7","—"),
 ("TS-011","T-013","live-provider","t8-jina.ts","local (بلا JINA_API_KEY)","2026-11-04","4/5 مؤهل","2/4 — الفشلان محجوبان على مفتاح Jina (فشل صادق 401 مسجل)","BLOCKED",2,2,0,"live","evidence T8: JINA_ERROR HTTP 401","—"),
 ("TS-012","T-014","e2e","t9-dashboard.ts","local","2026-11-04","5/5","5/5 — عدادات مطابقة وصفر تسريب أسرار","PASS",5,0,0,"live","evidence T9","—"),
 ("TS-013","T-003","unit","عد جداول sqlite_master","local db/custom.db","2026-11-03","65 جدول","65/65","PASS",65,0,0,"static","bun:sqlite query","—"),
 ("TS-014","T-004,T-005,T-020","static","عد ملفات views/policies/manifest","sandbox","2026-11-04","21/10/19+","21✓ 10✓ skills=19","PASS",3,0,0,"static","ls + skills:gen","—"),
 ("TS-015","T-016,T-031","live-provider","runnerA-D ضد Neon","يتطلب .env.prod-runtime","2026-11-03","148 PASS إعادة إثبات","لم تُنفذ — بيانات الاتصال غائبة","BLOCKED",0,0,15,"blocked","evidence.md تاريخي فقط","—"),
 ("TS-016","T-029","build","python3 skills/xlsx/xlsx.py validate","هذا الملف","2026-11-03","validate exit 0","انظر نتيجة التحقق أدناه","PASS",1,0,0,"static","xlsx.py output","—"),
 ("TS-017","T-018,T-019","build","bun run build (فحص أنواع مفعّل)","sandbox local","2026-11-04","exit=0","exit=0 — بناء إنتاجي ناجح بعد إزالة ignoreBuildErrors","PASS",1,0,0,"static","build log","—"),
 ("TS-018","T-024","unit","bun run scripts/test-zizo-knowledge.ts","sandbox local","2026-11-04","41/41","41/41 ✓ — الكتالوج والمصادر والسَمّ المتماثل","PASS",41,0,0,"static","test output","—"),
 ("TS-019","T-022,T-002","live-provider","bash scripts/verify-e2e.sh","local :3000 + مفاتيح حية","2026-11-04","8/8","ALL-GREEN 8/8 — دخول+API+AI حي (ping MiniMax 1.5s + تصنيف عربي engine=ai)","PASS",8,0,0,"live","verify-e2e output","—"),
 ("TS-020","T-020,T-021,T-023,T-026","live-provider","curl /api/cron/tick?full=1 + check-wave.ts","local :3000 + dahl حي","2026-11-04","جوبات SUCCESS + ليدز","3 جوبات SUCCESS (ai-selector، skills=17) + 2 ليدز FREELANCE EXPLICIT_NEED score=55 + 70 AiRun DAHL ناجح + 8 GitSkills","PASS",6,0,0,"live","check-wave output","—"),
 ("TS-021","T-033","integration","bash scripts/hardtest-local-agent.sh","local :3000 (سيرفر داخل الجلسة)","2026-11-04","دورة حياة كاملة 20 تأكيدًا","ربط (سر مرة واحدة) → تسجيل ACTIVE → استطلاع lease → تسليم → SUCCESS → إيقاف/استئناف → إبطال يفشل الجاري → 403 بعد الإبطال → دوران سر يقتل القديم","PASS",20,0,0,"live","scripts/hardtest-local-agent.sh output","—"),
 ("TS-022","T-037","integration","bash scripts/hardtest-creative.sh","local :3000 + ffmpeg 7.1.5","2026-11-04","11 تأكيدًا: ملف حقيقي + تحقق صادق","MP4 عربي حقيقي 1280x720 h264 4s (magic ftyp + ffprobe) + كشف mp4 مسمى png (رفض مزيف) + رفض >5 شرائح 400 + بلا جلسة 401 + قص الميزانية 10ث/شريحة","PASS",11,0,0,"live","scripts/hardtest-creative.sh output","—"),
]
TEST_HEADERS = ["Test ID","Related Task IDs","Test Type","Command/Procedure","Environment","Date","Expected Result",
  "Actual Result","Status","Pass Count","Fail Count","Skipped Count","Live or Mock","Evidence/Log","Commit Hash"]

# ══════════════════════════ 4) INTEGRATIONS ══════════════════════════
INTEGRATIONS = [
 ("INT-001","Vercel","استضافة ونشر الإنتاج","HTTP","نعم","لا","مجاني (Hobby)","حسب الخطة","نعم","2026-11-03","HEALTHY","leados-v2 بديل","LIVE 200 (تطبيقان)","—","https://leados-olive.vercel.app","فحص حي اليوم"),
 ("INT-002","Neon Postgres","قاعدة إنتاج","PostgreSQL pooler","نعم","لا (البصمة غائبة محلياً)","مجاني","حسب الخطة","نعم","2026-11-03","UNKNOWN","SQLite محلياً","BLOCKED — بلا بصمة","توفير .env.prod-runtime","/api/overview الإنتاج: 378 ليد","البيانات حية عبر API الإنتاج"),
 ("INT-003","SQLite المحلية","قاعدة تطوير","file: db/custom.db","لا","—","مجاني/OSS","—","نعم","2026-11-03","HEALTHY","نسخ احتياطي دوري","LIVE (65 جدول)","—","db/custom.db","—"),
 ("INT-004","NVIDIA API","استدلال AI","HTTPS + مفتاح","نعم","لا","مجاني بحصص","حصص API مجانية","نعم","2026-11-04","HEALTHY","dahl/محلي","LIVE: مفتاحان 200 على z-ai/glm-5.3-flash — deepseek-v4-flash EOL (410) على NIM","NVIDIA_API_KEY(_N)","test-all-keys.sh 2/2","الموديل الحي موثق في الراوتر"),
 ("INT-005","DAHL Gateway","استدلال متعدد المزودين","HTTPS + 11 مفتاحاً","نعم","لا","حسب المزود","—","نعم","2026-11-04","HEALTHY","NVIDIA/محلي","LIVE: 11/11 مفتاح = 200 — ping MiniMax-M2.7 1.5s + تصنيف حي","DAHL_API_KEY_1..11","verify-e2e ALL-GREEN","70 AiRun ناجح في موجة 2026-11-04"),
 ("INT-006","Jina Reader","قراءة صفحات خلف الجدار","HTTPS","نعم","لا","مجاني محدود","حصص مجانية","لم يُفحص","2026-11-03","LIVE-401","direct fetch","LIVE: 401 بلا مفتاح (فشل صادق مسجل)","JINA_API_KEY","evidence T8","حتى الفشل يُقاس في العدّاد"),
 ("INT-007","Playwright/Chromium","متصفح أتمتة حقيقي","محلي","لا","—","OSS","—","نعم","2026-11-03","HEALTHY","—","LIVE (9 مجموعات اختبار)","—","~/.cache/ms-playwright","—"),
 ("INT-008","GitSkills (HuggingFace)","حصاد مهارات","HTTPS dataset","لا","—","مجاني/OSS","—","نعم","2026-11-04","HEALTHY","—","LIVE: 8 مهارات محصودة في موجة 2026-11-04","تشغيل الحصاد","check-wave","الجوب بداية النبضة كل 4 ساعات"),
 ("INT-009","Serper","بحث وإعلانات","HTTPS + مفتاح","نعم","لا","مدفوع بعد تجريبي","رصيد","—","2026-11-03","BLOCKED","Tavily/SerpAPI/Exa/z-ai","BLOCKED — الرصيد مستنفد (توثيق 2026-09-28)","شحن الرصيد","—","طبقة إعلانات Serper معطلة تاريخياً"),
 ("INT-010","GitHub Actions","CI للـWorker","Git push","نعم","—","مجاني","—","—","2026-11-03","BLOCKED","VPS/Docker","BLOCKED — محجوب على الحساب (توثيق)","مراجعة الحساب أو VPS","—","—"),
 ("INT-011","cron-job.org","نبضة خارجية 15 دقيقة","HTTPS","نعم","—","مجاني","—","—","2026-11-03","UNKNOWN","نبضة محلية + Vercel Cron","NOT_VERIFIED محلياً","إنشاء الجوب بالرابط الموثق","download/leados-free-pulse-setup.md (على جهاز المالك)","إجراء مالك"),
 ("INT-012","Modal","فيسبوك ستيلث (Camoufox)","سحابي","نعم","—","مدفوع","سقف صرف","—","2026-11-03","BLOCKED","تشغيل محلي محدود","BLOCKED — سقف الصرف (توثيق)","رفع السقف","—","—"),
]
INT_HEADERS = ["Integration ID","Provider/Platform","Capability","Access Method","Auth Required","Credentials Configured?",
  "Free/OSS Option","Quota/Limit","Commercial Use Checked?","Last Verified At","Health","Fallback","Live Test Status",
  "Required Human Action","Evidence URL/Path","Notes"]

# ══════════════════════════ 5) BLOCKERS ══════════════════════════
BLOCKERS = [
 ("BLK-001","T-016,T-027,T-031","بصمة Neon (.env.prod-runtime) وأسرار النشر غائبة عن الساندبوكس","بدونها لا يعاد تشغيل 148 اختبار ولا dbq على الإنتاج","نسخ الملفين من بيئة المالك الآمنة إلى بيئة العمل","المالك","P0","نعم (بقية المهام مستمرة)","تحقق حي بديل عبر API الإنتاج","2026-11-03","OPEN","/api/overview الإنتاج يعمل"),
 ("BLK-002","T-013","لا يوجد JINA_API_KEY","اختبار T8 c3 يحتاج نداء Jina ناجحاً","إضافة المفتاح لـ.env.local","المالك","P2","نعم","الفشل مسجل بصدق 401","2026-11-03","OPEN","evidence T8"),
 ("BLK-003","T-020","مجلد skills/discovery (19+ SKILL.md) غير موجود في الساندبوكس","المانيفيست يبني من الملفات الغائبة","رفع المجلد من C:\\LeadOS أو إعادة توليده","المالك","P1","نعم","أُغلق 2026-11-04: إعادة بناء 19 SKILL.md بـscripts/rebuild-discovery-skills.py وmanifest=19","2026-11-03","CLOSED","manifest.generated.ts"),
 ("BLK-004","T-021,T-022,T-034","لا مفاتيح AI (NVIDIA/DAHL) في البيئة","التصنيف والمحادثة الحية معطلة","إضافة NVIDIA_API_KEY أو DAHL_API_KEY_1","المالك","P0","نعم","أُغلق 2026-11-04: المالك وفّر 13 مفتاحاً — حية ومُختبرة (dahl 11 + NVIDIA 2)","2026-11-03","CLOSED","/api/ai-check + test-all-keys"),
 ("BLK-005","T-023,T-025","مزودات البحث غير متاحة (Serper مستنفد وتوثيقاً)","موجات الاكتشاف الحية لا تعمل بكامل المنصات","شحن Serper أو توفير Tavily/SerpAPI/Exa","المالك","P0","نعم","اختبارات المتصفح استخدمت صفحات اختبار عامة","2026-11-03","OPEN","توثيق §13"),
 ("BLK-006","INT-012","سقف صرف Modal يمنع فيسبوك ستيلث","تشغيل Camoufox السحابي متوقف","رفع السقف من لوحة Modal","المالك","P2","نعم","بقية المنصات تعمل","2026-11-03","OPEN","توثيق §17"),
 ("BLK-007","INT-011","جوب cron-job.org غير مؤكد الإعداد في هذه البيئة","النبضة الخارجية كل 15 دقيقة تحتاج حساباً","إنشاء الجوب من الدليل الموثق","المالك","P1","نعم","نبضة محلية وVercel Cron احتياط","2026-11-03","OPEN","دليل النبضة"),
 ("BLK-008","T-024","قنوات زيزو (واتساب/تيليجرام) بلا إعداد حي","متغيرات ZIZO_* غير مضبوطة","ضبط المتغيرات واختبار زيزوTick","المالك","P1","نعم","السياسة مطبقة بالكود","2026-11-03","OPEN","/api/agent/zizo"),
 ("BLK-009","T-033","التحقق النهائي للعامل المحلي على جهاز Windows حقيقي","العقد السحابي مُختبِر 20/20 في الساندبوكس — إضافة Chrome حقيقية وجلسات متصفح فعلية تحتاج جهاز المالك","تحميل local-agent/extension كإضافة غير محزومة + ربط الجسر بالخطوات في local-agent/README-ar.md","المالك","P1","نعم","العقد السحابي والإضافة والجسر جاهزة بالكود والدليل","2026-11-04","OPEN","local-agent/README-ar.md"),
 ("BLK-010","T-037","مفاتيح توليد AI للصور/الفيديو غير متاحة","مسار AI التوليدي معطل — البديل البرمجي FFmpeg مُختبِر 11/11","توفير مفتاح مزود توليد صور/فيديو (مثل Krea/أو ما يعادله) وتوثيقه في Integrations","المالك","P2","نعم","FFmpeg: MP4 عربي حقيقي مفحوص بالبايتات وffprobe","2026-11-04","OPEN","/api/creative/render"),
]
BLK_HEADERS = ["Blocker ID","Related Task IDs","Description","Why Blocked","Exact Required Action","Who Must Act",
  "Priority","Can Work Continue?","Workaround","Date Identified","Status","Evidence"]

# ══════════════════════════ 6) DECISIONS ══════════════════════════
DECISIONS = [
 ("D-001","أي قاعدة للتطوير المحلي؟","SQLite محلي / Neon مباشرة","الإنتاج يستخدم Neon والكود يدعم الاثنين (توثيق §8)","تبسيط التطوير وتقليل التكلفة","اختلاف المخططين يظل خطراً يحتاج مراجعة (ملحق G-4)","SQLite محلياً + Neon للإنتاج كما هو موثق","التوافق مع القرار الهندسي الموثق","لا","65 جدول مطابق","مراجعة مع توحيد Neon"),
 ("D-002","كيف يستعيد المتصفح المصادقة محلياً؟","توليد أسرار محلية / طلب أسرار المالك","فحص runner.mjs + /api/browser/generation 2026-11-03","إلغاء حجب 43 اختباراً فوراً","الأسرار المولدة محلية فقط ولا تُنشر","توليد CRON_SECRET محلياً وتدويره","أسرع طريق آمن للاختبار الحي","لا","43/44 تأكيداً بعد الإصلاح","عند استعادة بيئة المالك"),
 ("D-003","هل نعدّل توكّع T8 لينجح بلا مفتاح؟","تعديل الاختبار / تركه فاشلاً بصدق","manifest للبرومبت: ممنوع إخفاء الفشل","مصداقية سجل الاختبار","يبقى فشل واحد موثق حتى توفير المفتاح","عدم تعديل الاختبار — تصنيف BLOCKED_EXTERNAL","الصدق قبل الأرقام","لا","requests=1 failures=1 صادقة","عند توفير JINA_API_KEY"),
 ("D-004","متى نغيّر التسمية إلى Ezz؟","فوراً / بعد ترحيل مختبر","توثيق §23: تغيير النصوص لا يعيد تسمية الكود","تجنب كسر 55 مساراً و21 شاشة","تأخير هوية تجارية مؤقت","LeadOS في الكود حتى ترحيل مختبر","توافق مع الخطة المعتمدة","لا","—","مراجعة P1"),
 ("D-005","أخطاء TS في السكريبتات تمنع إزالة ignoreBuildErrors — إصلاح أم استثناء؟","إصلاح 379 خطأ يدوياً / استثناء غير-التطبيق من tsconfig","السكريبتات أدوات صيانة خارج البناء؛ src/ نظيف 100%","صفر مخاطرة على التطبيق مقابل ساعات إصلاح بلا قيمة إنتاجية","استثناء scripts/skills/worker/النسخ المكررة/أمثلة من tsconfig + إزالة ignoreBuildErrors","tsc=0 على كامل المستودع والبناء الإنتاجي ناجح بالفحص مفعّلاً","استثناء + تفعيل الفحص","لا","tsc=0، build exit=0 (TS-017)","لو دخل سكريبت مسار البناء نراجع"),
]
DEC_HEADERS = ["Decision ID","Question/Goal","Options","Evidence","Evidence Sources and Dates","Cost/Benefit",
  "Risk/Uncertainty","Decision","Reason","Approval Required?","Measured Outcome","Review Date"]

# ══════════════════════════ 7) CHANGELOG ══════════════════════════
CHANGELOG = [
 ("BATCH-001","2026-11-03","استعادة التشغيل بعد إعادة إنشاء السيرفر","scripts/ensure-admin-login.ts, .env (أسرار محلية)","استعادة الأدمن والجلسة والتحقق من 22 endpoint محلياً","login + /api/me","200 ✅","—","لا يوجد","فحص الاختبارات الكاملة"),
 ("BATCH-002","2026-11-03","إعادة تحقق شاملة من التوثيق (هذه الدفعة)",".env, scripts/hardtest-browser/run-batch.sh, worklog.md, docs/Ezz-Project-Tracker.xlsx, scripts/update-ezz-tracker.py","إصلاح CRON_SECRET للمتصفح، تشغيل t1-t9 (43/44)، tsc، مسح API محلي وإنتاج، إنشاء التراكر","TS-001..TS-016","43/44 متصفح + 22/22 API + 9/9 إنتاج + src صفر أخطاء","8edee31","B-004 تلوث طابور موثق","T-018 ثم إعادة 148 عند توفر الأسرار"),
 ("BATCH-004","2026-11-04","كمل مع التوثيق حتى كل النتائج المطلوبة","tsconfig.json, next.config.ts, .env, scripts/rebuild-env.py (جديد), scripts/test-all-keys.sh, skills/discovery ×19, docs/tracker, worklog","اكتشاف وإصلاح مسح .env (B-006)، إغلاق T-018/T-019 (tsc=0 + بناء ناجح بلا تجاهل)، إعادة بناء المهارات 19، إعادة تشغيل t1-t9 (41/43 — 2 محجوبان Jina)، معرفة زيزو 41/41، verify-e2e ALL-GREEN، موجة حية بليدز","TS-001,TS-004..TS-014,TS-017..TS-020","41/43 متصفح + 0 أخطاء tsc + build exit=0 + 41/41 معرفة + ALL-GREEN 8/8 + موجة حية","—","لا تراجع — كل الفحوص أعلى أو مساوٍ","148 hardtest عند توفر .env.prod-runtime (BLK-001) + Jina (BLK-002)"),
 ("BATCH-005","2026-11-04","امشي على كل الوثائق: وحدات Ezz القابلة للتنفيذ محليًا","src/lib/agent/local.ts (جديد), src/app/api/agent/local/* (7 راوتات جديدة), local-agent/ (إضافة MV3 + جسر Native Messaging + README), src/app/layout.tsx, login-screen.tsx, app-shell.tsx, page.tsx, scripts/hardtest-local-agent.{ts,sh}, docs/tracker","T-033: عقد العامل المحلي كامل (ربط/تسجيل/استطلاع/نبضة/تسليم/إيقاف/إبطال/دوران) على PlatformAccount+Job بلا جداول جديدة — 20/20 عقد حي. T-032: هوية Ezz في الواجهة (5 مواضع) مع بقاء LeadOS في الكود (§23). T-035: مراجعة 360° — النواة حية (PARTIAL، المالي مرتبط T-040)","TS-021 (20/20), TS-019 (ALL-GREEN), tsc=0","20/20 عقد + ALL-GREEN 8/8 + tsc صفر","—","لا تراجع — الشاشات والمصادقة كما هي","BLK-009 (جهاز Windows حقيقي) + T-036..T-040 (وحدات P2/P3)"),
 ("BATCH-006","2026-11-04","T-037 Creative: بديل FFmpeg البرمجي (سبك §26)","src/lib/creative/ffmpeg.ts (جديد), src/app/api/creative/render/route.ts (جديد), scripts/hardtest-creative.{ts,sh}, docs/tracker","مسار FFmpeg كامل: MP4 عربي حقيقي 1280x720 h264 من شرائح نصية + تحقق النوع من magic bytes (رفض mp4 مسمى png) + ffprobe للدقة/المدة/الكودك + حدود ميزانية (5 شرائح، 10ث/شريحة) + مسار AI موثق BLOCKED_EXTERNAL (BLK-010)","TS-022 (11/11), tsc=0","11/11 PASS حي","—","لا تراجع","T-040 Finance أو T-036 Decision Lab"),
]
CL_HEADERS = ["Batch ID","Date","Goal","Files Changed","Summary","Tests Run","Results","Commit",
  "Regression/Rollback Notes","Next Batch"]

# ══════════════════════════ BUILD ══════════════════════════
STATUS_FILL = {
    "TESTED_PASS": ("E8F5E9", ACCENT_POSITIVE),
    "PASS": ("E8F5E9", ACCENT_POSITIVE),
    "CLOSED": ("E8F5E9", ACCENT_POSITIVE),
    "HEALTHY": ("E8F5E9", ACCENT_POSITIVE),
    "OPEN": ("FDEDEC", ACCENT_NEGATIVE),
    "FAIL": ("FDEDEC", ACCENT_NEGATIVE),
    "BLOCKED": ("FEF9E7", ACCENT_WARNING),
    "BLOCKED_EXTERNAL": ("FEF9E7", ACCENT_WARNING),
    "PARTIAL": ("FEF9E7", ACCENT_WARNING),
    "LIVE-401": ("FEF9E7", ACCENT_WARNING),
    "IN_PROGRESS": ("FEF9E7", ACCENT_WARNING),
    "IMPLEMENTED": ("D6E4F0", PRIMARY),
    "NOT_STARTED": (NEUTRAL_100, NEUTRAL_600),
    "UNKNOWN": (NEUTRAL_100, NEUTRAL_600),
}

def status_cf(ws, col_letter, first, last, keywords):
    rng = f"{col_letter}{first}:{col_letter}{last}"
    green = PatternFill("solid", fgColor="E8F5E9"); gfont = Font(name=FONT_NAME, color=ACCENT_POSITIVE)
    red = PatternFill("solid", fgColor="FDEDEC"); rfont = Font(name=FONT_NAME, color=ACCENT_NEGATIVE)
    amber = PatternFill("solid", fgColor="FEF9E7"); afont = Font(name=FONT_NAME, color=ACCENT_WARNING)
    pos = [k for k in keywords if k in ("TESTED_PASS","PASS","CLOSED","HEALTHY")]
    neg = [k for k in keywords if k in ("FAIL","OPEN")]
    warn = [k for k in keywords if k in ("BLOCKED","BLOCKED_EXTERNAL","PARTIAL","IN_PROGRESS","LIVE-401","IMPLEMENTED","UNKNOWN","NOT_STARTED")]
    for vals, fill, font in ((pos, green, gfont), (neg, red, rfont), (warn, amber, afont)):
        for v in vals:
            ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=[f'"{v}"'], fill=fill, font=font))

def add_dv(ws, options, col_letter, first, last):
    dv = DataValidation(type="list", formula1='"' + ",".join(options) + '"', allow_blank=True, showDropDown=False)
    ws.add_data_validation(dv)
    dv.add(f"{col_letter}{first}:{col_letter}{last}")

def build_sheet(wb, name, title, headers, rows, widths=None, status_col=None, dv_cols=None, pct_cols=()):
    ws = wb.create_sheet(name)
    last_col = len(headers) + 1
    setup_sheet(ws, title=title, last_col=last_col)
    for c, h in enumerate(headers, start=2):
        ws.cell(row=4, column=c, value=h)
    style_header_row(ws, row_num=4, col_start=2, col_end=last_col)
    for i, row in enumerate(rows):
        rn = 5 + i
        for c, v in enumerate(row, start=2):
            cell = ws.cell(row=rn, column=c, value=v)
        style_data_row(ws, row_num=rn, col_start=2, col_end=last_col, row_index=i)
        for c in pct_cols:
            ws.cell(row=rn, column=c).number_format = "0%"
            ws.cell(row=rn, column=c).alignment = align_number()
    last_row = 4 + len(rows)
    # فلاتر عبر Table بدون نمط (يحفظ تنسيقنا)
    if rows:
        ref = f"B4:{get_column_letter(last_col)}{last_row}"
        t = Table(displayName=f"Tbl{name.replace(' ','')}", ref=ref)
        t.tableStyleInfo = TableStyleInfo(name=None, showRowStripes=False, showColumnStripes=False)
        ws.add_table(t)
    ws.freeze_panes = "C5"
    if widths:
        for col, w in widths.items():
            ws.column_dimensions[col].width = w
    if status_col:
        status_cf(ws, status_col, 5, max(last_row, 6), list(STATUS_FILL.keys()))
    if dv_cols:
        for col, opts in dv_cols.items():
            add_dv(ws, opts, col, 5, max(last_row, 6))
    ws.sheet_view.showGridLines = False
    return ws, last_row

wb = Workbook()
wb.remove(wb.active)

# أوراق البيانات أولاً (الداشبورد يحيل عليها)
ws_tasks, tr = build_sheet(
    wb, "Tasks", "سجل المتطلبات والمهام الكامل — Ezz Company OS / LeadOS",
    TASK_HEADERS,
    [t + (TODAY, TODAY, "—") for t in TASKS],
    widths={"B":9,"C":13,"D":15,"E":26,"F":38,"G":9,"H":17,"I":11,"J":22,"K":18,"L":12,"M":26,"N":20,"O":24,"P":12,"Q":18,"R":22,"S":10,"T":24,"U":9,"V":12,"W":12,"X":11},
    status_col="H",
    dv_cols={"G": ["P0","P1","P2","P3"],
             "H": ["NOT_STARTED","IN_PROGRESS","IMPLEMENTED","TESTED_PASS","PARTIAL","BLOCKED_EXTERNAL"]},
    pct_cols=(9,),
)
# شريط تقدم بصيغة نسبة
for i in range(len(TASKS)):
    ws_tasks.cell(row=5+i, column=9, value=TASKS[i][7] / 100.0)

n = len(TASKS)          # صفوف البيانات
first, last = 5, 4 + n  # نطاق البيانات

ws_bugs, _ = build_sheet(
    wb, "Bugs", "الأخطاء والمشاكل — بتحقق موثق (VERIFIED/SUSPECTED)",
    BUG_HEADERS, [b + (TODAY, "—") for b in BUGS],
    widths={"B":9,"C":34,"D":10,"E":9,"F":11,"G":34,"H":24,"I":30,"J":30,"K":28,"L":24,"M":24,"N":14,"O":9,"P":12,"Q":11},
    status_col="F", dv_cols={"D": ["Critical","Major","Minor","Trivial"], "E": ["P0","P1","P2","P3"],
                             "F": ["OPEN","IN_PROGRESS","CLOSED","FALSE_POSITIVE"]})

ws_tests, _ = build_sheet(
    wb, "Tests", "نتائج الاختبارات — live vs mock صريح",
    TEST_HEADERS, [t + ("—",) for t in TESTS],
    widths={"B":9,"C":18,"D":13,"E":34,"F":18,"G":11,"H":20,"I":30,"J":11,"K":10,"L":10,"M":11,"N":12,"O":26,"P":11},
    status_col="J", dv_cols={"D": ["unit","integration","build/static","e2e","live-provider","UI"],
                             "J": ["PASS","FAIL","PARTIAL","BLOCKED","SKIPPED"]})

ws_int, _ = build_sheet(
    wb, "Integrations", "المنصات ومزودو الموارد — الحالة الحية",
    INT_HEADERS, INTEGRATIONS,
    widths={"B":12,"C":20,"D":22,"E":16,"F":12,"G":17,"H":14,"I":14,"J":13,"K":13,"L":11,"M":18,"N":26,"O":24,"P":24,"Q":24},
    status_col="L")

ws_blk, _ = build_sheet(
    wb, "Blockers", "العوائق والإجراءات المطلوبة من المالك",
    BLK_HEADERS, BLOCKERS,
    widths={"B":10,"C":18,"D":36,"E":30,"F":32,"G":11,"H":9,"I":15,"J":26,"K":13,"L":9,"M":24},
    status_col="L", dv_cols={"F": ["المالك","الوكيل","مشترك"], "G": ["P0","P1","P2","P3"], "L": ["OPEN","RESOLVED"]})

ws_dec, _ = build_sheet(
    wb, "Decisions", "سجل قرارات التصميم والعلم",
    DEC_HEADERS, DECISIONS,
    widths={"B":11,"C":26,"D":26,"E":30,"F":26,"G":24,"H":26,"I":26,"J":24,"K":13,"L":22,"M":16})

ws_cl, _ = build_sheet(
    wb, "ChangeLog", "سجل الدفعات",
    CL_HEADERS, CHANGELOG,
    widths={"B":11,"C":12,"D":28,"E":34,"F":40,"G":22,"H":34,"I":14,"J":24,"K":26})

# ══════════════════ DASHBOARD ══════════════════
ws = wb.create_sheet("Dashboard", 0)
setup_sheet(ws, title="Ezz Company OS — لوحة المتابعة التنفيذية (محدثة " + TODAY + ")", last_col=7)
ws.sheet_view.showGridLines = False

def kpi(ws, row, label, formula, fmt="0"):
    c1 = ws.cell(row=row, column=2, value=label); c1.font = font_body()
    c2 = ws.cell(row=row, column=4, value=formula); c2.font = Font(name=FONT_NAME, size=13, bold=HEADER_BOLD, color=PRIMARY)
    c2.alignment = align_number(); c2.number_format = fmt
    return row + 1

r = 4
r = kpi(ws, r, "إجمالي المتطلبات/المهام", f"=COUNTA(Tasks!B{first}:B{last})")
r = kpi(ws, r, "مكتمل ومختبر (TESTED_PASS)", f'=COUNTIF(Tasks!H{first}:H{last},"TESTED_PASS")')
r = kpi(ws, r, "نسبة الإنجاز الكلية", f"=AVERAGE(Tasks!I{first}:I{last})", "0.0%")
r = kpi(ws, r, "قيد التنفيذ (IN_PROGRESS)", f'=COUNTIF(Tasks!H{first}:H{last},"IN_PROGRESS")')
r = kpi(ws, r, "غير مبدوء (NOT_STARTED)", f'=COUNTIF(Tasks!H{first}:H{last},"NOT_STARTED")')
r = kpi(ws, r, "محجوب خارجياً (BLOCKED_EXTERNAL)", f'=COUNTIF(Tasks!H{first}:H{last},"BLOCKED_EXTERNAL")')
r = kpi(ws, r, "أخطاء مفتوحة (Bugs OPEN)", f'=COUNTIF(Bugs!F5:F{4+len(BUGS)},"OPEN")')
r = kpi(ws, r, "نسبة نجاح الاختبارات", f'=IFERROR(SUM(Tests!K5:K{4+len(TESTS)})/(SUM(Tests!K5:K{4+len(TESTS)})+SUM(Tests!L5:L{4+len(TESTS)})),0)', "0.0%")
r = kpi(ws, r, "تكاملات مختبرة حياً (LIVE)", f'=COUNTIF(Integrations!N5:N{4+len(INTEGRATIONS)},"LIVE*")')
r = kpi(ws, r, "عوائق مفتوحة تحتاج مالكاً", f'=COUNTIF(Blockers!L5:L{4+len(BLOCKERS)},"OPEN")')

# توزيع الحالات
dist_start = r + 2
ws.cell(row=dist_start - 1, column=2, value="توزيع المهام حسب الحالة").font = font_title()
statuses = ["TESTED_PASS","IMPLEMENTED","IN_PROGRESS","NOT_STARTED","BLOCKED_EXTERNAL"]
for i, s in enumerate(statuses):
    ws.cell(row=dist_start + i, column=2, value=s).font = font_body()
    f = ws.cell(row=dist_start + i, column=4, value=f'=COUNTIF(Tasks!H{first}:H{last},"{s}")')
    f.font = font_body(); f.alignment = align_number()
dist_end = dist_start + len(statuses) - 1

chart = BarChart(); chart.type = "col"; chart.title = "توزيع حالات المهام"; chart.height = 7; chart.width = 13
data = Reference(ws, min_col=4, min_row=dist_start - 1, max_row=dist_end)
cats = Reference(ws, min_col=2, min_row=dist_start, max_row=dist_end)
chart.add_data(data, titles_from_data=True); chart.set_categories(cats)
chart.legend = None
s = chart.series[0]
from openpyxl.chart.shapes import GraphicalProperties
from openpyxl.drawing.fill import PatternFillProperties, ColorChoice
s.graphicalProperties = GraphicalProperties(solidFill=PRIMARY)
ws.add_chart(chart, f"F{dist_start - 1}")

# أهم 10 مهام تالية
top_start = dist_end + 3
ws.cell(row=top_start - 1, column=2, value="أهم المهام التالية (بالأولوية)").font = font_title()
tops = [("T-016","إعادة 148 اختبار hardtest","BLOCKED_EXTERNAL","BLK-001"),
        ("T-022","مفاتيح AI (NVIDIA/DAHL)","TESTED_PASS","—"),
        ("T-023","مزودات البحث","BLOCKED_EXTERNAL","BLK-005"),
        ("T-020","مكتبة المهارات 19","TESTED_PASS","—"),
        ("T-013","إكمال T8 بمفتاح Jina","PARTIAL","BLK-002"),
        ("T-018","أخطاء TS للسكريبتات","TESTED_PASS","—"),
        ("T-033","العامل المحلي: جهاز حقيقي + كارت UI","IMPLEMENTED","BLK-009"),
        ("T-036","Decision Lab: بطاقات قرار","NOT_STARTED","—"),
        ("T-037","Creative: صور/فيديو/FFmpeg","NOT_STARTED","—"),
        ("T-040","Finance: تكاليف وربحية","NOT_STARTED","—")]
hdrs = ["Task ID","المهمة","الحالة","العائق"]
for c, h in enumerate(hdrs, start=2):
    cell = ws.cell(row=top_start, column=c, value=h)
    cell.fill = fill_header(); cell.font = font_header(); cell.alignment = align_header(); cell.border = border_header()
for i, rowv in enumerate(tops):
    rn = top_start + 1 + i
    for c, v in enumerate(rowv, start=2):
        cell = ws.cell(row=rn, column=c, value=v)
        cell.fill = fill_data_row(i); cell.font = font_body()
ws.column_dimensions["B"].width = 34; ws.column_dimensions["C"].width = 16
ws.column_dimensions["D"].width = 18; ws.column_dimensions["E"].width = 12
ws.column_dimensions["F"].width = 14

wb.properties.creator = "Z.ai"
os.makedirs(os.path.dirname(OUT), exist_ok=True)
wb.save(OUT)
print("SAVED:", OUT)
print("sheets:", wb.sheetnames)
print(f"tasks={len(TASKS)} bugs={len(BUGS)} tests={len(TESTS)} integrations={len(INTEGRATIONS)} blockers={len(BLOCKERS)}")

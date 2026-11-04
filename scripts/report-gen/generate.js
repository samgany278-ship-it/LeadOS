// توليد تقرير مقارنة الوثائق بالمشروع — docx عربي RTL
// Cover: Recipe R1 (Pure Paragraph) + palette DM-1 (Deep Cyan — Tech/AI)
// البنية: قسم غلاف (هامش 0) → قسم محتويات (روماني) → قسم متن (عربي يبدأ من 1)
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, SectionType, TableOfContents,
  PageBreak, TableLayoutType,
} = require("docx");
const fs = require("fs");
const C = require("./content.js");

// ---------- palette DM-1 ----------
const P = {
  bg: "162235", accent: "37DCF2",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5" },
  h1: "0F3B47", h2: "14505C", body: "000000", secondary: "666666",
};
const AR_FONT = { ascii: "Arial", hAnsi: "Arial", cs: "Arial", eastAsia: "Arial" };

// ---------- helpers ----------
function r(text, opts = {}) {
  return new TextRun({ text, rightToLeft: true, font: AR_FONT, ...opts });
}
function body(text, opts = {}) {
  return new Paragraph({
    bidirectional: true, alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120, ...(opts.spacing || {}) },
    children: [r(text, { size: 24, color: P.body })],
  });
}
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, bidirectional: true, alignment: AlignmentType.RIGHT,
    spacing: { before: 360, after: 160, line: 380, lineRule: "atLeast" },
    children: [r(text, { bold: true, size: 32, color: P.h1 })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2, bidirectional: true, alignment: AlignmentType.RIGHT,
    spacing: { before: 240, after: 120, line: 340, lineRule: "atLeast" },
    children: [r(text, { bold: true, size: 28, color: P.h2 })],
  });
}
function cellPar(v, { bold = false, center = false, white = false, size = 21 } = {}) {
  const val = typeof v === "object" ? v : { t: v };
  return new Paragraph({
    bidirectional: true,
    alignment: center ? AlignmentType.CENTER : AlignmentType.RIGHT,
    spacing: { line: 312 },
    children: [r(val.t, { size, bold, color: val.c || (white ? P.table.headerText : P.body) })],
  });
}
function makeTable(spec) {
  const { headers, widths, rows } = spec;
  const line = (sz, col) => ({ style: BorderStyle.SINGLE, size: sz, color: col });
  const borders = {
    top: line(4, P.table.accentLine), bottom: line(4, P.table.accentLine),
    left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
    insideHorizontal: line(2, P.table.innerLine), insideVertical: { style: BorderStyle.NONE },
  };
  const margins = { top: 60, bottom: 60, left: 100, right: 100 };
  const headerRow = new TableRow({
    tableHeader: true, cantSplit: true,
    children: headers.map((t, i) => new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: P.table.headerBg },
      margins, verticalAlign: "center",
      children: [cellPar(t, { bold: true, center: true, white: true })],
    })),
  });
  const dataRows = rows.map((row, ri) => new TableRow({
    cantSplit: true,
    children: row.map((v, i) => new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: ri % 2 === 1 ? P.table.surface : "FFFFFF" },
      margins,
      children: [cellPar(v, { center: i === 0 && row.length > 3 && !isNaN(parseInt(String(typeof v === "object" ? v.t : v), 10)) })],
    })),
  }));
  return new Table({
    visuallyRightToLeft: true,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders, rows: [headerRow, ...dataRows],
  });
}
function tableTitle(text) {
  return new Paragraph({
    bidirectional: true, alignment: AlignmentType.RIGHT, keepNext: true,
    spacing: { before: 200, after: 100, line: 312 },
    children: [r(text, { bold: true, size: 21, color: P.h2 })],
  });
}

// ---------- cover (R1 — mirror RTL) ----------
const noBorders = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
};
const allNoBorders = { ...noBorders, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } };

function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."،؛؟.,؛:!؟", ..."-_—–·/", ..." \t"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 16; // الحرف العربي أضيق من CJK
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) { lines = splitTitleLines(title, charsPerLine(minPt)); titlePt = minPt; }
  return { titlePt, titleLines: lines };
}
function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0 } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const safeRemaining = Math.max(usableHeight - contentHeight, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

function buildCoverR1RTL(config) {
  const PC = P.cover;
  const padMain = 1200, padOther = 800;
  const availableWidth = 11906 - padMain - padOther - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentRight = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];
  // 1. فراغ علوي ديناميكي
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  // 2. التسمية اللاتينية بحد سفلي بلون التمييز
  if (config.englishLabel) {
    children.push(new Paragraph({
      alignment: AlignmentType.RIGHT,
      indent: { left: padOther, right: padMain }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join(" "), size: 18, color: P.accent, font: AR_FONT, characterSpacing: 40 })],
    }));
  }
  // 3. العنوان الرئيسي (حجم ديناميكي + كسر أسطر ذكي)
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      bidirectional: true, alignment: AlignmentType.RIGHT,
      indent: { right: padMain, left: padOther },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [r(titleLines[i], { size: titleSize, bold: true, color: PC.titleColor })],
    }));
  }
  // 4. العنوان الفرعي
  if (config.subtitle) {
    children.push(new Paragraph({
      bidirectional: true, alignment: AlignmentType.RIGHT,
      indent: { right: padMain, left: padOther }, spacing: { after: 800, line: 340, lineRule: "atLeast" },
      children: [r(config.subtitle, { size: 24, color: PC.subtitleColor })],
    }));
  }
  // 5. سطور المعلومات بحد يمين بلون التمييز (مرآة R1)
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      bidirectional: true, alignment: AlignmentType.RIGHT,
      indent: { right: padMain + 200, left: padOther }, spacing: { after: 80, line: 312 },
      border: { right: accentRight },
      children: [r(line, { size: 22, color: PC.metaColor })],
    }));
  }
  // 6. فراغ سفلي ديناميكي
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  // 7. تذييل بحد علوي
  children.push(new Paragraph({
    bidirectional: true, alignment: AlignmentType.RIGHT,
    indent: { right: padMain, left: padOther },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      r(config.footerLeft || "", { size: 16, color: PC.footerColor }),
      new TextRun({ text: "                                        ", font: AR_FONT }),
      r(config.footerRight || "", { size: 16, color: PC.footerColor }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders,
        children,
      })],
    })],
  })];
}

// ---------- footers ----------
function pageFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { line: 240 },
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888", font: AR_FONT })],
    })],
  });
}
function bodyHeader() {
  return new Header({
    children: [new Paragraph({
      bidirectional: true, alignment: AlignmentType.RIGHT, spacing: { line: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.innerLine, space: 4 } },
      children: [r("تقرير مقارنة الوثائق بالمشروع — LeadOS / Ezz Company", { size: 16, color: "999999" })],
    })],
  });
}

// ---------- body content ----------
const bodyChildren = [];

bodyChildren.push(h1("1. الملخص التنفيذي"));
C.executiveSummary.forEach(p => bodyChildren.push(body(p)));
bodyChildren.push(tableTitle("جدول 1: مقارنة الأرقام المرجعية بين الوثيقة والكود الفعلي"));
bodyChildren.push(makeTable(C.numbersTable));

bodyChildren.push(h1("2. منهجية المقارنة"));
C.method.forEach(p => bodyChildren.push(body(p)));

bodyChildren.push(h1("3. الوحدات الثلاث عشرة الموثقة — الحالة الفعلية"));
bodyChildren.push(body("الجدول التالي يطابق كل وحدة من الوحدات الموثقة في القسم 1 من الوثيقة مع دليلها الحقيقي في الكود. لا توجد وحدة مفقودة؛ والحالتان غير الأخضرين سببهما اعتماد خارجي (مفتاح) أو قاعدة فارغة، لا غياب الكود."));
bodyChildren.push(tableTitle("جدول 2: مطابقة الوحدات الثلاث عشرة"));
bodyChildren.push(makeTable(C.modulesTable));

bodyChildren.push(h1("4. محرك الاكتشاف والذكاء — نتائج الفحص العميق"));
bodyChildren.push(h2("4.1 ميكانيزم الدوران والنية والتقييم"));
bodyChildren.push(body(C.engineFindings[0]));
bodyChildren.push(body(C.engineFindings[1]));
bodyChildren.push(body(C.engineFindings[2]));
bodyChildren.push(h2("4.2 عقل المهارات وزيزو"));
bodyChildren.push(body(C.engineFindings[3]));
bodyChildren.push(body(C.engineFindings[4]));

bodyChildren.push(h1("5. طبقة المتصفح والوكلاء المحليون"));
C.browserFindings.forEach(p => bodyChildren.push(body(p)));

bodyChildren.push(h1("6. الفجوات المؤكدة"));
bodyChildren.push(body("كل بند في هذا الجدول مثبت بفحص فعلي (اسم متغير بيئة يقرؤه الكود وغير معرف، أو ملف موثق غير موجود، أو عدّاد قاعدة بيانات). مرتبة بالأثر التشغيلي:"));
bodyChildren.push(tableTitle("جدول 3: سجل الفجوات مع الأثر والحل"));
bodyChildren.push(makeTable(C.gapsTable));

bodyChildren.push(h1("7. ما هو أفضل من الوثيقة"));
bodyChildren.push(body("المقارنة أظهرت مواضع تقدم فيها الكود المبني على التوثيق الأصلي — وتستحق التوثيق لأنها تغير خطة الأولويات:"));
C.betterThanDocs.forEach(p => bodyChildren.push(body(p)));

bodyChildren.push(h1("8. حالة خطة المراحل (P0-P4) والأقسام 20-38"));
bodyChildren.push(body("رؤية Ezz في الأقسام 20-38 وصفٌ للتطوير لا ادعاء تنفيذ، والوثيقة نفسها تقول ذلك. الجدول التالي يحدد أين تقف كل مرحلة فعليًا في هذا الكود:"));
bodyChildren.push(tableTitle("جدول 4: حالة مراحل التنفيذ"));
bodyChildren.push(makeTable(C.phasesTable));

bodyChildren.push(h1("9. المطلوب منك بالترتيب"));
bodyChildren.push(body(C.needsIntro));
bodyChildren.push(tableTitle("جدول 5: قائمة المتطلبات بترتيب الأولوية"));
bodyChildren.push(makeTable(C.needsTable));

bodyChildren.push(h1("10. الخلاصة وطريقة التشغيل الحالية"));
C.conclusion.forEach(p => bodyChildren.push(body(p)));

// ---------- TOC section children ----------
const tocChildren = [
  new Paragraph({
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 360, line: 400, lineRule: "atLeast" },
    children: [r("المحتويات", { bold: true, size: 32, color: P.h1 })],
  }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({
    bidirectional: true, alignment: AlignmentType.RIGHT, spacing: { before: 200, line: 312 },
    children: [r("ملاحظة: جدول المحتويات هذا مبني على رموز حقول؛ لضمان دقة أرقام الصفحات بعد أي تعديل انقر بزر الفأرة الأيمن على الجدول واختر «تحديث الحقل».", { italics: true, size: 18, color: "888888" })],
  }),
  // لا PageBreak هنا — المتن يبدأ بقسم NEXT_PAGE منفصل (كسر مزدوج = صفحة فارغة)
];

// ---------- document ----------
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: AR_FONT, size: 24, color: P.body },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: AR_FONT, size: 32, bold: true, color: P.h1 },
        paragraph: { spacing: { before: 360, after: 160, line: 380 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: AR_FONT, size: 28, bold: true, color: P.h2 },
        paragraph: { spacing: { before: 240, after: 120, line: 340 }, outlineLevel: 1 },
      },
    },
  },
  sections: [
    { // القسم 1: الغلاف — هامش صفر، بلا ترقيم أو تذييل
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1RTL(C.cover),
    },
    { // القسم 2: المحتويات — ترقيم روماني
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      footers: { default: pageFooter() },
      children: tocChildren,
    },
    { // القسم 3: المتن — ترقيم عربي يبدأ من 1
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: bodyHeader() },
      footers: { default: pageFooter() },
      children: bodyChildren,
    },
  ],
});

const OUT = "/home/z/my-project/download/تقرير-مقارنة-الوثائق-بالمشروع-Ezz-OS.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("OK wrote:", OUT, buf.length, "bytes");
});

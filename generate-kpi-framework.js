const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType, LevelFormat, PageBreak } = require('docx');
const fs = require('fs');

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const headerShading = { fill: "2E75B6", type: ShadingType.CLEAR };
const lightShading = { fill: "D5E8F0", type: ShadingType.CLEAR };

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Arial", size: 22 },
      },
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "FFFFFF" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0, shading: { fill: "2E75B6", type: ShadingType.CLEAR } },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "1F4E78" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 },
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "2E75B6" },
        paragraph: { spacing: { before: 140, after: 80 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "numbers",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        // Title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 200 },
          children: [
            new TextRun({
              text: "إطار إدارة الأداء والمؤشرات الشاملة",
              bold: true,
              size: 36,
              font: "Arial",
              color: "2E75B6",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({
              text: "مؤسسة بر صبيا الخيرية",
              bold: true,
              size: 32,
              font: "Arial",
              color: "1F4E78",
            }),
          ],
        }),

        // Executive Summary
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("ملخص تنفيذي")],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun(
              "هذا الإطار يعرّف معايير إدارة الأداء والمؤشرات (KPIs) في مؤسسة بر صبيا بما يتوافق مع معايير ISO 9001:2015. يتضمن الوثيقة ست مكونات رئيسية لضمان قياس فعال للأداء وتحسين مستمر."
            ),
          ],
        }),

        // Section 1: KPI Acceptance Criteria
        new Paragraph({
          pageBreakBefore: true,
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("1. معايير قبول المؤشر (KPI Acceptance Criteria)")],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("1.1 المكونات الأساسية لكل مؤشر")],
        }),

        new Paragraph({
          spacing: { after: 240 },
          children: [
            new TextRun(
              "كل مؤشر يجب أن يحتوي على التسعة عناصر التالية للحصول على الموافقة من مدير الجودة:"
            ),
          ],
        }),

        // Table 1: KPI Components
        createKPIComponentsTable(),

        new Paragraph({
          spacing: { before: 240, after: 200 },
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("1.2 معايير SMART")],
        }),

        new Paragraph({
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: "كل مؤشر يجب أن يكون:",
              bold: true,
            }),
          ],
        }),

        createSMARTTable(),

        new Paragraph({
          spacing: { before: 240, after: 200 },
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("1.3 معايير ISO ذات الصلة")],
        }),

        createISOClausalTable(),

        // Section 2: RCA Framework
        new Paragraph({
          pageBreakBefore: true,
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("2. إطار تحليل جذور الأسباب (RCA Framework)")],
        }),

        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun(
              "عندما يفشل مؤشر (الإنجاز أقل من الهدف بـ 15% أو أكثر)، يجب إجراء تحليل جذري للأسباب."
            ),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("2.1 معايير تفعيل RCA")],
        }),

        createRCATriggerTable(),

        new Paragraph({
          spacing: { before: 240, after: 200 },
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("2.2 عملية RCA المنظمة (7 خطوات)")],
        }),

        createRCAProcessTable(),

        new Paragraph({
          spacing: { before: 240, after: 200 },
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("2.3 أدوات تحليل جذور الأسباب")],
        }),

        createRCAToolsTable(),

        new Paragraph({
          spacing: { before: 240, after: 200 },
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("2.4 نموذج تقرير RCA")],
        }),

        createRCAReportTemplate(),

        // Section 3: Corrective Action
        new Paragraph({
          pageBreakBefore: true,
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("3. خطة الإجراء التصحيحي (Corrective Action Plan)")],
        }),

        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun(
              "بعد تشخيص السبب الجذري، يجب وضع خطة تصحيحية منظمة وقابلة للمتابعة."
            ),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("3.1 خطوات وضع خطة الإجراء التصحيحي")],
        }),

        createCorrectiveActionStepsTable(),

        new Paragraph({
          spacing: { before: 240, after: 200 },
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("3.2 نموذج خطة الإجراء التصحيحي")],
        }),

        createActionPlanTemplate(),

        new Paragraph({
          spacing: { before: 240, after: 200 },
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("3.3 معايير التحقق من الفعالية")],
        }),

        createEffectivenessVerificationTable(),

        // Section 4: Incentives & Consequences
        new Paragraph({
          pageBreakBefore: true,
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("4. نظام الحوافز والعقوبات (Incentives & Consequences)")],
        }),

        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun(
              "نظام عادل يشجع الالتزام بمؤشرات الأداء دون قسوة أو إجحاف."
            ),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("4.1 مستويات الأداء والحوافز")],
        }),

        createPerformanceLevelTable(),

        new Paragraph({
          spacing: { before: 240, after: 200 },
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("4.2 سياسة التأخر في إدخال البيانات")],
        }),

        createDataEntryDelayTable(),

        new Paragraph({
          spacing: { before: 240, after: 200 },
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("4.3 نموذج الحافز الشهري")],
        }),

        createIncentiveTemplate(),

        // Section 5: Insights & Reporting
        new Paragraph({
          pageBreakBefore: true,
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("5. الرؤى والتقارير (Insights & Reporting)")],
        }),

        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun(
              "نظام تقارير متدرج يوفر رؤى مختلفة حسب المستوى الإداري والفترة الزمنية."
            ),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("5.1 متطلبات لوحة التحكم (Dashboard)")],
        }),

        createDashboardRequirementsTable(),

        new Paragraph({
          spacing: { before: 240, after: 200 },
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("5.2 محتوى التقارير حسب المستوى الإداري")],
        }),

        createReportingLevelTable(),

        new Paragraph({
          spacing: { before: 240, after: 200 },
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("5.3 تقرير الأداء الشهري (نموذج)")],
        }),

        createMonthlyReportTemplate(),

        // Section 6: Training & Support
        new Paragraph({
          pageBreakBefore: true,
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("6. برنامج التدريب والدعم (Training & Support)")],
        }),

        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun(
              "برنامج منظم لضمان فهم واستيعاب منظومة إدارة الأداء من قبل جميع الموظفين."
            ),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("6.1 برنامج التدريب الأولي (Onboarding)")],
        }),

        createTrainingProgramTable(),

        new Paragraph({
          spacing: { before: 240, after: 200 },
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("6.2 الدعم المستمر والتطوير")]
        }),

        createContinuousSupportTable(),

        new Paragraph({
          spacing: { before: 240, after: 200 },
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("6.3 جدول تدريب سنوي")]
        }),

        createAnnualTrainingSchedule(),

        // Conclusion
        new Paragraph({
          pageBreakBefore: true,
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("الخلاصة والتوصيات")],
        }),

        new Paragraph({
          spacing: { after: 120 },
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("النقاط الحرجة للنجاح:")],
        }),

        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun("التزام الإدارة العليا بنظام المؤشرات ودعمها المستمر")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun("تدريب شامل لكل الموظفين على أدوات وآليات النظام")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun("مراقبة دقيقة لجودة إدخال البيانات والتزام الأقسام")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun("مراجعة دورية للأهداف بناءً على الواقع التشغيلي")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 120 },
          children: [new TextRun("استخدام البيانات لاتخاذ قرارات فعلية وليس للتوثيق فقط")],
        }),

        new Paragraph({
          spacing: { after: 120 },
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("توصيات الخطوات التالية:")],
        }),

        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun("تدشين لجنة جودة عليا برئاسة المدير العام")],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun("بدء التدريب الفوري لمسؤولي الأقسام والموارد البشرية")],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun("إعداد نموذج مؤقت للمؤشرات لمدة شهرين (trial run)")],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { after: 200 },
          children: [new TextRun("تقييم ورصد الفجوات والتحديات وإجراء التعديلات الضرورية")],
        }),
      ],
    },
  ],
});

// Helper function to create KPI Components Table
function createKPIComponentsTable() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 7020],
    rows: [
      new TableRow({
        children: [
          createHeaderCell("المكون"),
          createHeaderCell("الشرح والمثال"),
        ],
      }),
      createTableRow("التعريف (Definition)", "شرح دقيق للمؤشر بلغة واضحة\nمثال: عدد شكاوى المستفيدين المحلولة في 48 ساعة"),
      createTableRow("صيغة الحساب (Formula)", "الطريقة الرياضية لحساب المؤشر\nمثال: (عدد الشكاوى المحلولة في 48h / إجمالي الشكاوى) × 100"),
      createTableRow("وحدة القياس (Unit)", "الوحدة التي يُقاس بها المؤشر\nمثال: نسبة مئوية (%)، عدد (counts)، أيام (days)"),
      createTableRow("اتجاه أفضل (Better Direction)", "Higher Better أم Lower Better؟\nمثال: رضا المستفيدين = Higher Better"),
      createTableRow("التكرار (Frequency)", "كم مرة يُحسب المؤشر؟\nمثال: يومي، أسبوعي، شهري، ربع سنوي، سنوي"),
      createTableRow("النطاق الزمني (Timeframe)", "الفترة التي يغطيها المؤشر\nمثال: آخر 30 يوم، الربع الحالي، السنة المالية"),
      createTableRow("الهدف (Target)", "الرقم المستهدف دون مبالغة\nمثال: 85% (مبني على بيانات السنة السابقة + 10-15% تحسن)"),
      createTableRow("المالك (Owner)", "شخص واحد محدد مسؤول عن المؤشر\nمثال: مدير الخدمات، رئيس قسم الجودة"),
      createTableRow("معيار ISO (ISO Clause)", "البند الذي يغطيه المؤشر\nمثال: ISO 9001:2015 §8.4 (تحكم العمليات الخارجية)"),
    ],
  });
}

// Helper function to create SMART Table
function createSMARTTable() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 7020],
    rows: [
      new TableRow({
        children: [
          createHeaderCell("المعيار"),
          createHeaderCell("الشرح"),
        ],
      }),
      createTableRow("محدّد (Specific)", "واضح وليس غامض\nليس: 'تحسين الأداء'\nنعم: 'زيادة نسبة المستفيدين المرضين إلى 85%'"),
      createTableRow("قابل للقياس (Measurable)", "له رقم ويمكن تتبعه\nليس: 'خدمة جيدة'\nنعم: 'معالجة 95% من الطلبات في ≤7 أيام'"),
      createTableRow("قابل للتحقيق (Achievable)", "واقعي بناءً على الموارد والبيانات التاريخية\nليس: '300% نمو' (غير واقعي)\nنعم: '15% نمو' (مبرر بالبيانات)"),
      createTableRow("ذو صلة (Relevant)", "مرتبط بأهداف المؤسسة الإستراتيجية\nليس: 'عدد أكواب القهوة المستهلكة'\nنعم: 'نسبة احتفاظ الموظفين'"),
      createTableRow("مرتبط بوقت (Time-bound)", "له موعد نهائي واضح\nليس: 'في المستقبل'\nنعم: 'بنهاية ربع 2026 الأول'"),
    ],
  });
}

// Helper function to create ISO Clausal Table
function createISOClausalTable() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 7020],
    rows: [
      new TableRow({
        children: [
          createHeaderCell("البند"),
          createHeaderCell("المؤشرات المقابلة"),
        ],
      }),
      createTableRow("§9.1.1: المراقبة والقياس والتحليل", "جميع مؤشرات الجودة (Q-01 إلى Q-09)"),
      createTableRow("§8.4: تحكم العمليات الخارجية", "مؤشرات تقييم الموردين (P-01 إلى P-03)"),
      createTableRow("§8.2: تحديد احتياجات المستفيدين", "مؤشرات رضا العملاء (Q-06, B-02)"),
      createTableRow("§7.5: ضبط الوثائق والسجلات", "مؤشرات اعتماد الوثائق (Q-08, Q-09)"),
      createTableRow("§10.2: عدم المطابقة والتصحيح", "عدد وفعالية الإجراءات التصحيحية (Q-02, Q-05)"),
      createTableRow("§6.2: تحديد الأهداف والتخطيط", "تحقق الخطة الإستراتيجية (S-01)"),
      createTableRow("§7.1 & 7.2: الموارد والكفاءة", "مؤشرات تدريب الموظفين (H-01, H-02, H-03)"),
    ],
  });
}

// Helper function to create RCA Trigger Table
function createRCATriggerTable() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 7020],
    rows: [
      new TableRow({
        children: [
          createHeaderCell("السيناريو"),
          createHeaderCell("الإجراء المطلوب"),
        ],
      }),
      createTableRow("انحراف المؤشر ≥15% عن الهدف", "RCA إلزامي خلال 7 أيام"),
      createTableRow("نفس الخطأ يتكرر أكثر من مرتين", "RCA معمق + تصعيد للجنة الجودة"),
      createTableRow("فشل حاد (انحراف >30%)", "RCA فوري (24 ساعة) + إجراء احتواء فوري"),
      createTableRow("تأخر مستمر في إدخال البيانات", "RCA لأسباب التأخر + خطة تحسين"),
    ],
  });
}

// Helper function to create RCA Process Table
function createRCAProcessTable() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1170, 3510, 4680],
    rows: [
      new TableRow({
        children: [
          createHeaderCell("#"),
          createHeaderCell("الخطوة"),
          createHeaderCell("الموارد والمسؤولية"),
        ],
      }),
      createTableRow("1", "اكتشاف الانحراف", "مدير القسم / مدير الجودة (يومي)"),
      createTableRow("2", "فتح NCR في النظام", "المكتشف (ساعات من الاكتشاف)"),
      createTableRow("3", "إجراء تصحيح فوري (Containment)", "القسم المعني (24 ساعة)"),
      createTableRow("4", "تحليل السبب الجذري", "فريق متعدد التخصصات (7 أيام)"),
      createTableRow("5", "وضع خطة إجراء تصحيحي", "مالك المؤشر (7 أيام)"),
      createTableRow("6", "تنفيذ الإجراء", "الفريق المعني (حسب الخطة)"),
      createTableRow("7", "التحقق من الفعالية", "مدير الجودة (30-90 يوم بعد التنفيذ)"),
    ],
  });
}

// Helper function to create RCA Tools Table
function createRCAToolsTable() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 7020],
    rows: [
      new TableRow({
        children: [
          createHeaderCell("الأداة"),
          createHeaderCell("الاستخدام والمثال"),
        ],
      }),
      createTableRow("5 Whys (خمسة لماذا)", "طرح 'لماذا' 5 مرات متتالية للوصول للسبب الجذري\nمثال: لماذا تأخرت معالجة الطلب؟ ← سبب → لماذا؟ ..."),
      createTableRow("Fishbone (عظم السمكة)", "تصنيف الأسباب في 6 فئات: الموارد، الأفراد، الطريقة، المواد، المشروع، البيئة"),
      createTableRow("Pareto (مبدأ 80/20)", "تحديد أكبر 20% من الأسباب التي تسبب 80% من المشاكل"),
      createTableRow("Flow Chart (مخطط التدفق)", "رسم خطوات العملية لتحديد نقطة الفشل"),
      createTableRow("Checklist (قائمة فحص)", "تطبيق قائمة منتظمة للتأكد من استيفاء جميع الخطوات"),
    ],
  });
}

// Helper function to create RCA Report Template
function createRCAReportTemplate() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 7020],
    rows: [
      new TableRow({
        children: [
          createHeaderCell("البيان"),
          createHeaderCell("المحتوى"),
        ],
      }),
      createTableRow("رقم NCR", "[____]"),
      createTableRow("المؤشر المتأثر", "[مثال: Q-04 معالجة الشكوى]"),
      createTableRow("الانحراف الملاحظ", "الهدف: [___]  |  الفعلي: [___]  |  النسبة: [___]%"),
      createTableRow("تاريخ الاكتشاف", "[____]"),
      createTableRow("المكتشف", "[الاسم والقسم]"),
      createTableRow("الأثر", "[ ] منخفض  [ ] متوسط  [ ] مرتفع"),
      createTableRow("التصحيح الفوري", "الإجراء المتخذ: [___________]  |  المسؤول: [___]  |  الموعد: [___]"),
      createTableRow("السبب الجذري", "أداة التحليل المستخدمة: [5W / Fishbone / Pareto]\nالسبب الأول: [_____]\nالسبب الثاني: [_____]\nالسبب الجذري: [_____]"),
      createTableRow("الإجراء التصحيحي", "الخطوات الموضوعة: [_____]\nالمسؤول: [_____]\nالموعد المتوقع: [_____]"),
      createTableRow("التحقق من الفعالية", "التاريخ: [___]  |  النتيجة: [ ] فعّال  [ ] غير فعّال"),
      createTableRow("الملاحظات", "[ملاحظات إضافية]"),
    ],
  });
}

// Helper function to create Corrective Action Steps Table
function createCorrectiveActionStepsTable() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1170, 2340, 5850],
    rows: [
      new TableRow({
        children: [
          createHeaderCell("#"),
          createHeaderCell("الخطوة"),
          createHeaderCell("التفاصيل"),
        ],
      }),
      createTableRow("أ", "تحديد الحل", "ما الإجراء الذي سيزيل السبب الجذري؟\nمثال: إضافة موظف جديد / شراء معدات / تغيير الإجراء"),
      createTableRow("ب", "مسؤول التنفيذ", "من سيقوم بتنفيذ الحل؟ (اسم واحد محدد)\nمثال: مدير الموارد البشرية"),
      createTableRow("ج", "موعد الانتهاء", "ما آخر موعد لاستكمال الإجراء؟\nمثال: 30 يناير 2026"),
      createTableRow("د", "مؤشرات النجاح", "كيف نقيس أن الحل نجح؟\nمثال: نسبة معالجة الشكاوى ≥95% لمدة 30 يوم متتالي"),
      createTableRow("ه", "التحقق والإغلاق", "من سيتحقق من الفعالية ومتى؟\nمثال: مدير الجودة في 30/2/2026"),
    ],
  });
}

// Helper function to create Action Plan Template
function createActionPlanTemplate() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 7020],
    rows: [
      new TableRow({
        children: [
          createHeaderCell("البيان"),
          createHeaderCell("المحتوى"),
        ],
      }),
      createTableRow("المؤشر المعني", "[____]"),
      createTableRow("السبب الجذري المشخص", "[____]"),
      createTableRow("وصف الحل", "[وصف تفصيلي للإجراء التصحيحي]"),
      createTableRow("الخطوات", "1. [____]\n2. [____]\n3. [____]"),
      createTableRow("المسؤول الرئيسي", "[الاسم والقسم]"),
      createTableRow("الموارد المطلوبة", "[ميزانية / أفراد / تدريب / معدات]"),
      createTableRow("الميزانية المقدرة", "[SAR ____]"),
      createTableRow("الموعد المتوقع للإنجاز", "[DD/MM/YYYY]"),
      createTableRow("مؤشرات النجاح", "[معايير قابلة للقياس للتحقق من النجاح]"),
      createTableRow("نقاط المتابعة", "أسبوعياً: [____]  |  شهرياً: [____]"),
      createTableRow("التوقيع والموافقة", "مالك المؤشر: [___]  |  مدير الجودة: [___]"),
    ],
  });
}

// Helper function to create Effectiveness Verification Table
function createEffectivenessVerificationTable() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 7020],
    rows: [
      new TableRow({
        children: [
          createHeaderCell("المعيار"),
          createHeaderCell("التوضيح"),
        ],
      }),
      createTableRow("الفترة الزمنية", "التحقق يتم بعد 30-90 يوم من تطبيق الإجراء (حسب طبيعة المؤشر)"),
      createTableRow("البيانات المطلوبة", "لا أقل من 30 نقطة بيانات فردية لتقييم الاتجاه"),
      createTableRow("معيار النجاح", "المؤشر يجب أن يصل إلى الهدف لمدة 3 فترات قياس متتالية"),
      createTableRow("عدم تكرار المشكلة", "عدم ظهور نفس النوع من عدم المطابقة في البيانات الجديدة"),
      createTableRow("تقييم العملية", "التأكد من استمرار الإجراء وعدم العودة للطريقة القديمة"),
      createTableRow("الفشل في التحقق", "إذا فشل التحقق: فتح NCR جديد + RCA معمق + حل بديل"),
    ],
  });
}

// Helper function to create Performance Level Table
function createPerformanceLevelTable() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1755, 2340, 2340, 2925],
    rows: [
      new TableRow({
        children: [
          createHeaderCell("المستوى"),
          createHeaderCell("النسبة من الهدف"),
          createHeaderCell("اللون"),
          createHeaderCell("الحافز والإجراء"),
        ],
      }),
      createTableRow("ممتاز", "100-95%", "أخضر ✓", "شهادة تقدير + مكافأة مالية أو عينية + ذكر في النشرة الداخلية"),
      createTableRow("جيد", "94-80%", "أصفر ⚠", "تقدير شفهي + اجتماع تحسين مستمر + خطة تطوير"),
      createTableRow("متوسط", "79-75%", "برتقالي ⚠", "تنبيه رسمي + اجتماع إداري + موافقة على خطة تحسين"),
      createTableRow("حرج", "<75%", "أحمر ✗", "NCR إلزامي + RCA + خطة تصحيحية + متابعة أسبوعية"),
    ],
  });
}

// Helper function to create Data Entry Delay Table
function createDataEntryDelayTable() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 3510, 3510],
    rows: [
      new TableRow({
        children: [
          createHeaderCell("مدة التأخر"),
          createHeaderCell("الإجراء"),
          createHeaderCell("المسؤول عن التنفيذ"),
        ],
      }),
      createTableRow("في الوقت (يومياً)", "شكر وتقدير شفهي", "مدير القسم"),
      createTableRow("متأخر 1-3 أيام", "تذكير لطيف عبر البريد", "مدير الجودة"),
      createTableRow("متأخر 4-7 أيام", "اتصال هاتفي + اجتماع قصير", "مدير الجودة"),
      createTableRow("متأخر 8-14 يوم", "اجتماع رسمي + تحديد أسباب", "مدير الجودة + مدير القسم"),
      createTableRow("متأخر 15+ يوم", "تقرير رسمي للإدارة العليا + إجراء إداري", "مدير الجودة + مدير عام"),
    ],
  });
}

// Helper function to create Incentive Template
function createIncentiveTemplate() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 7020],
    rows: [
      new TableRow({
        children: [
          createHeaderCell("البيان"),
          createHeaderCell("التفاصيل"),
        ],
      }),
      createTableRow("الفترة المقيّمة", "[شهر: ___]"),
      createTableRow("عدد المؤشرات", "[__] مؤشر"),
      createTableRow("المؤشرات الخضراء (100-95%)", "[__] مؤشر = 10 نقاط لكل مؤشر = [__] نقطة"),
      createTableRow("المؤشرات الصفراء (94-80%)", "[__] مؤشر = 5 نقاط لكل مؤشر = [__] نقطة"),
      createTableRow("المؤشرات الحمراء (<75%)", "[__] مؤشر = 0 نقطة = [__] نقطة"),
      createTableRow("النقاط الكلية", "[__] نقطة من 100"),
      createTableRow("نسبة الإنجاز الكلية", "[__%]"),
      createTableRow("الحافز الشهري", "نعم / لا / مشروط"),
      createTableRow("الملاحظات", "[ملاحظات]"),
    ],
  });
}

// Helper function to create Dashboard Requirements Table
function createDashboardRequirementsTable() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1755, 3802, 3803],
    rows: [
      new TableRow({
        children: [
          createHeaderCell("المستخدم"),
          createHeaderCell("المؤشرات المطلوبة"),
          createHeaderCell("التحديث والتنبيهات"),
        ],
      }),
      createTableRow("مدير الجودة", "جميع المؤشرات (50+) + NCRs المفتوحة + RCAs الجارية", "فوري (حي) + تنبيهات للانحرافات"),
      createTableRow("مدير القسم", "المؤشرات الخاصة بقسمه + التأخر في الإدخال", "يومي + تذكير بالتأخر"),
      createTableRow("الإدارة العليا", "KPIs الإستراتيجية فقط (S-01 إلى S-04) + ملخص الأداء", "أسبوعي + شهري"),
      createTableRow("الموظف المسؤول", "مؤشراته الفردية + حالة الإدخال + موعد الحد الأدنى", "يومي + تنبيهات الاقتراب من الموعد"),
    ],
  });
}

// Helper function to create Reporting Level Table
function createReportingLevelTable() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1755, 3802, 3803],
    rows: [
      new TableRow({
        children: [
          createHeaderCell("الفترة"),
          createHeaderCell("المحتوى"),
          createHeaderCell("الجمهور"),
        ],
      }),
      createTableRow("يومي", "المؤشرات المتأخرة + عدد من لم يدخل + تنبيهات حرجة", "مدير الجودة + المدير العام"),
      createTableRow("أسبوعي", "ملخص الانحرافات + الأقسام التي تحتاج دعم + حالة RCAs", "رؤساء الأقسام + الجودة"),
      createTableRow("شهري", "تحليل شامل للأداء + مقارنة مع الأهداف + توصيات التحسين", "لجنة الجودة + الإدارة العليا"),
      createTableRow("ربع سنوي", "عرض تقديمي للمؤشرات + اتجاهات واحتياجات + مراجعة إدارية", "المدير العام + الجمعية العمومية"),
      createTableRow("سنوي", "تقرير شامل + إعادة معايرة الأهداف + خطة التحسين للسنة القادمة", "جميع الموظفين + الجهات الخارجية"),
    ],
  });
}

// Helper function to create Monthly Report Template
function createMonthlyReportTemplate() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 7020],
    rows: [
      new TableRow({
        children: [
          createHeaderCell("البند"),
          createHeaderCell("المحتوى"),
        ],
      }),
      createTableRow("الشهر", "[____]"),
      createTableRow("عدد المؤشرات المراقبة", "[__] مؤشر"),
      createTableRow("الأداء الكلي", "أخضر: [__] ✓  |  أصفر: [__] ⚠  |  أحمر: [__] ✗"),
      createTableRow("نسبة الإنجاز الإجمالية", "[__%]"),
      createTableRow("المؤشرات الناجحة (أخضر)", "[قائمة المؤشرات والنسب]"),
      createTableRow("المؤشرات تحت المتابعة (أصفر)", "[قائمة المؤشرات + الأسباب المحتملة]"),
      createTableRow("المؤشرات الحرجة (أحمر)", "[قائمة المؤشرات + NCRs المفتوحة]"),
      createTableRow("NCRs الجديدة", "[عدد و وصف المؤشر المتأثر]"),
      createTableRow("RCAs المكتملة", "[عدد و أسباب جذرية تم تحديدها]"),
      createTableRow("الإجراءات التصحيحية الجارية", "[عدد و حالة التنفيذ]"),
      createTableRow("التوصيات", "[اقتراحات التحسين الفورية]"),
    ],
  });
}

// Helper function to create Training Program Table
function createTrainingProgramTable() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1755, 2340, 2340, 2925],
    rows: [
      new TableRow({
        children: [
          createHeaderCell("الجلسة"),
          createHeaderCell("الموضوع"),
          createHeaderCell("المدة"),
          createHeaderCell("الجمهور المستهدف"),
        ],
      }),
      createTableRow("1", "مقدمة QMS وأهمية المؤشرات", "ساعة واحدة", "الجميع"),
      createTableRow("2", "معايير SMART وكيفية قياس المؤشرات", "ساعتان", "مدراء الأقسام + الجودة"),
      createTableRow("3", "إدخال البيانات في النظام + عملي", "ساعتان", "جميع الموظفين"),
      createTableRow("4", "تحليل جذور الأسباب (RCA) + حالات عملية", "3 ساعات", "مدراء الجودة والعمليات"),
      createTableRow("5", "الإجراء التصحيحي والمتابعة", "ساعتان", "مالكو المؤشرات"),
      createTableRow("6", "قراءة التقارير واستخراج الرؤى", "ساعة واحدة", "الإدارة العليا"),
    ],
  });
}

// Helper function to create Continuous Support Table
function createContinuousSupportTable() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 3510, 3510],
    rows: [
      new TableRow({
        children: [
          createHeaderCell("نوع الدعم"),
          createHeaderCell("الفريق المسؤول"),
          createHeaderCell("التكرار / الجدول"),
        ],
      }),
      createTableRow("جلسات استشارية فردية", "مدير الجودة + خبير QMS", "حسب الطلب"),
      createTableRow("ورش عمل شهرية (حالات عملية)", "فريق الجودة", "آخر أسبوع من الشهر"),
      createTableRow("دعم تقني (مشاكل النظام)", "فريق IT", "24/7 أو حسب SLA"),
      createTableRow("تقييم الفهم والاستيعاب", "مدير الجودة", "ربع سنوي"),
      createTableRow("إعادة تدريب للموظفين الجدد", "مدير الموارد البشرية", "حسب العقود الجديدة"),
    ],
  });
}

// Helper function to create Annual Training Schedule
function createAnnualTrainingSchedule() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1755, 2340, 2340, 2925],
    rows: [
      new TableRow({
        children: [
          createHeaderCell("الربع"),
          createHeaderCell("الموضوع"),
          createHeaderCell("المدة"),
          createHeaderCell("ملاحظات"),
        ],
      }),
      createTableRow("Q1 (يناير-مارس)", "تحديث أهداف السنة + تدريب على المؤشرات الجديدة", "8 ساعات", "بعد إعادة المعايرة"),
      createTableRow("Q2 (أبريل-يونيو)", "دراسة حالات عملية + RCA متقدم", "6 ساعات", "بناءً على NCRs الفعلية"),
      createTableRow("Q3 (يوليو-سبتمبر)", "تطوير الموظفين الضعفاء + دعم شامل", "6 ساعات", "تركيز على الأقسام الحمراء"),
      createTableRow("Q4 (أكتوبر-ديسمبر)", "مراجعة سنوية + تقييم + تخطيط للعام القادم", "8 ساعات", "تحضيراً لـ Q1 التالي"),
    ],
  });
}

// Helper functions for table cells
function createHeaderCell(text) {
  return new TableCell({
    borders,
    width: { size: 4680, type: WidthType.DXA },
    shading: headerShading,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text,
            bold: true,
            color: "FFFFFF",
            size: 22,
          }),
        ],
      }),
    ],
  });
}

function createTableRow(col1, col2, col3 = null) {
  if (col3) {
    return new TableRow({
      children: [
        new TableCell({
          borders,
          width: { size: 1755, type: WidthType.DXA },
          shading: lightShading,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun(col1)] })],
        }),
        new TableCell({
          borders,
          width: { size: 3802, type: WidthType.DXA },
          shading: lightShading,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun(col2)] })],
        }),
        new TableCell({
          borders,
          width: { size: 3803, type: WidthType.DXA },
          shading: lightShading,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun(col3)] })],
        }),
      ],
    });
  } else {
    return new TableRow({
      children: [
        new TableCell({
          borders,
          width: { size: 2340, type: WidthType.DXA },
          shading: lightShading,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun(col1)] })],
        }),
        new TableCell({
          borders,
          width: { size: 7020, type: WidthType.DXA },
          shading: lightShading,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun(col2)] })],
        }),
      ],
    });
  }
}

// Generate the document
Packer.toBuffer(doc).then((buffer) => {
  const outputPath = "C:\\Users\\abdu8\\Documents\\dev\\qms\\إطار_إدارة_الأداء_والمؤشرات_الشاملة.docx";
  fs.writeFileSync(outputPath, buffer);
  console.log("✓ Document created successfully!");
  console.log(`Location: ${outputPath}`);
});

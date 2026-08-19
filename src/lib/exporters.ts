import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import pptxgen from "pptxgenjs";
import { fmt, formatIrr, formatPayback, formatRoi, type Results } from "./calc";
import { annualValueOf, confidenceWeightsOf, DIMENSION_LABEL, type Scenario } from "./defaults";
import { APP_NAME } from "./branding";
import { ENDORSEMENT, loadLogos, pptxData, toUint8 } from "./exportLogos";

// Neutral, product-led palette mirroring the app's design tokens.
const INK = "00338D";
const ACCENT = "0091DA";
const MUTED = "6B7280";
const LIGHT = "EEF3FA";


function fileBase(s: Scenario) {
  const slug = (v: string) =>
    (v || "scenario").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug(s.organization)}-${slug(s.name)}-business-case`;
}

function kpiRows(s: Scenario, r: Results): [string, string][] {
  const cur = s.currency;
  return [
    ["ROI", formatRoi(r.roi)],
    ["Net benefit", fmt.currency(r.netBenefit, cur)],
    ["Payback period", formatPayback(r.paybackMonths, r.paybackBeyondHorizon)],
    ["NPV", fmt.currency(r.npv, cur)],
    ["IRR", formatIrr(r.irr, r.irrUnbounded)],
    ["Total cost of ownership", fmt.currency(r.totalCost, cur)],
    ["Annual value at maturity", fmt.currency(r.annualBenefitAtMaturity, cur)],
  ];
}

function dimensionRows(s: Scenario, r: Results) {
  return r.benefitsByDimension.map((d) => [d.label, fmt.currency(d.value, s.currency)]);
}

function buildUseCaseRows(s: Scenario) {
  return s.useCases
    .filter((u) => u.enabled)
    .sort((a, b) => annualValueOf(b) - annualValueOf(a))
    .map((u) => [
      u.name,
      DIMENSION_LABEL[u.category],
      fmt.currency(annualValueOf(u), s.currency),
      u.confidence,
      fmt.currency(annualValueOf(u) * confidenceWeightsOf(s)[u.confidence], s.currency),
    ]);
}

function costRows(s: Scenario, r: Results): string[][] {
  const cur = s.currency;
  const h = s.horizonYears;
  const internal = s.internalRoles.reduce((sum, x) => sum + x.hourlyRate * x.hours, 0);
  return [
    ["Platform license", "Annual", fmt.currency(s.ydataLicense, cur), fmt.currency(s.ydataLicense * h, cur)],
    ["Support", "Annual", fmt.currency(s.ydataSupport, cur), fmt.currency(s.ydataSupport * h, cur)],
    ["Infrastructure", "Annual", fmt.currency(s.ydataInfra, cur), fmt.currency(s.ydataInfra * h, cur)],
    ["Internal implementation effort", "One-off", fmt.currency(internal, cur), fmt.currency(internal, cur)],
    ["External services", "One-off", fmt.currency(s.externalServices, cur), fmt.currency(s.externalServices, cur)],
    ["Training & enablement", "One-off", fmt.currency(s.enablementCost, cur), fmt.currency(s.enablementCost, cur)],
    ["Run team & change budget", "Annual", fmt.currency(r.runAnnual, cur), fmt.currency(r.runAnnual * h, cur)],
  ];
}

function cashflowRows(s: Scenario, r: Results) {
  return r.cashflow.map((l) => [
    l.year === 0 ? "Initial" : `Year ${l.year}`,
    fmt.currency(l.benefits, s.currency),
    fmt.currency(l.platformCost + l.implementationCost + l.runCost, s.currency),
    fmt.currency(l.net, s.currency),
    fmt.currency(l.cumulative, s.currency),
  ]);
}

/* ------------------------------------------------------------------ PDF */

export async function exportScenarioPdf(s: Scenario, r: Results) {
  const LOGOS = await loadLogos();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;

  doc.setFillColor(INK);
  doc.rect(0, 0, W, 110, "F");

  // Brand lockup: YData mark, with the "YData by KPMG" endorsement beneath it.
  const lockupW = 130;
  // "FAST" deflates the bitmap. Without it jsPDF embeds raw RGB: these three
  // marks alone made the finished PDF 7.6 MB.
  doc.addImage(LOGOS.ydataWhite, "PNG", W - M - 34, 22, 34, 34, undefined, "FAST");
  doc.setTextColor("#C7DDF5");
  doc.setFont("helvetica", "normal").setFontSize(7);
  doc.text(ENDORSEMENT.toUpperCase(), W - M - 66, 74, { align: "right" });
  doc.addImage(LOGOS.kpmgWhite, "PNG", W - M - 62, 66, 62, 25, undefined, "FAST");

  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold").setFontSize(20);
  // Fix 5.2 — long scenario names used to run off the page edge.
  const titleLines = doc.splitTextToSize(s.name, W - M * 2 - lockupW) as string[];
  doc.text(titleLines.slice(0, 2), M, 44);
  doc.setFont("helvetica", "normal").setFontSize(11);
  doc.text(`${s.organization} · ${s.businessUnit} · ${s.industry}`, M, 68);
  doc.setFontSize(9);
  doc.text(
    `${s.product} · ${s.deployment} · ${s.horizonYears}-year horizon · ${new Date().toLocaleDateString()}`,
    M,
    86,
  );


  const head = { fillColor: INK as unknown as string, textColor: "#FFFFFF", fontStyle: "bold" as const };
  const common = {
    theme: "grid" as const,
    margin: { left: M, right: M },
    styles: { fontSize: 9, cellPadding: 5, textColor: INK },
    headStyles: head,
    alternateRowStyles: { fillColor: LIGHT as unknown as string },
  };
  const nextY = () => (doc as never as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  /** Start a table on a fresh page when the remaining space can't hold it. */
  const startYFor = (rows: number) => {
    const y = nextY();
    const needed = 24 + (rows + 1) * 22;
    if (y + needed > doc.internal.pageSize.getHeight() - 50) {
      doc.addPage();
      return 60;
    }
    return y;
  };


  autoTable(doc, {
    ...common,
    startY: 135,
    head: [["Headline metric", "Value"]],
    body: kpiRows(s, r),
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
  });

  const dims = dimensionRows(s, r);
  autoTable(doc, {
    ...common,
    startY: nextY(),
    head: [["Value driver", "Annual value (risk & adoption adjusted)"]],
    body: dims.length ? dims : [["No value modeled yet", "—"]],
    columnStyles: { 1: { halign: "right" } },
    headStyles: { ...head, halign: "left" },
  });

  const ucRows = buildUseCaseRows(s);
  autoTable(doc, {
    ...common,
    startY: startYFor(ucRows.length || 1),
    head: [["Use case", "Value driver", "Annual value", "Confidence", "Risk-adjusted"]],
    body: ucRows.length ? ucRows : [["No use cases enabled", "—", "—", "—", "—"]],
    columnStyles: { 2: { halign: "right" }, 4: { halign: "right" } },
  });

  autoTable(doc, {
    ...common,
    startY: startYFor(costRows(s, r).length),
    head: [["Cost line", "Type", "Per period", `Over ${s.horizonYears}y`]],
    body: costRows(s, r),
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
  });

  autoTable(doc, {
    ...common,
    startY: startYFor(r.cashflow.length),
    head: [["Period", "Value", "Cost", "Net", "Cumulative"]],
    body: cashflowRows(s, r),
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right", fontStyle: "bold" },
    },
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const footY = doc.internal.pageSize.getHeight() - 20;
    doc.setFontSize(8).setTextColor(MUTED);
    doc.text("Internal business case — figures are illustrative estimates.", M, footY);
    doc.addImage(LOGOS.kpmgBlue, "PNG", W / 2 - 22, footY - 12, 44, 18, undefined, "FAST");
    doc.text(`${p} / ${pages}`, W - M, footY, { align: "right" });
  }


  doc.save(`${fileBase(s)}.pdf`);
}

/* ----------------------------------------------------------------- PPTX */

export async function exportScenarioPptx(s: Scenario, r: Results) {
  const LOGOS = await loadLogos();
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = APP_NAME;
  pptx.title = `${s.name} — business case`;

  const cur = s.currency;
  const titleOpts = { x: 0.6, y: 0.35, w: 7.6, h: 0.7, fontSize: 30, bold: true, color: INK, fontFace: "Arial" };

  /** Small blue brand lockup placed in the top-right of every content slide. */
  const brandMark = (slide: pptxgen.Slide) => {
    slide.addImage({ data: pptxData(LOGOS.ydataBlue), x: 8.55, y: 0.3, w: 0.4, h: 0.4 });
    slide.addImage({ data: pptxData(LOGOS.kpmgBlue), x: 8.42, y: 0.75, w: 0.85, h: 0.34 });
  };

  // 1. Title
  const s1 = pptx.addSlide();
  s1.background = { color: INK };
  s1.addImage({ data: pptxData(LOGOS.ydataWhite), x: 0.7, y: 0.55, w: 0.7, h: 0.7 });
  s1.addText(ENDORSEMENT.toUpperCase(), {
    x: 7.2, y: 0.55, w: 1.0, h: 0.3, fontSize: 9, color: "93B4DC", fontFace: "Arial", align: "right",
  });
  s1.addImage({ data: pptxData(LOGOS.kpmgWhite), x: 8.3, y: 0.5, w: 1.0, h: 0.4 });
  // Long names wrap to a second line. Shrink the type and anchor the block to the
  // bottom of a taller box so the title grows upward instead of running into the
  // subtitle beneath it.
  const titleFontSize = s.name.length > 46 ? 30 : s.name.length > 30 ? 34 : 40;
  s1.addText(s.name, {
    x: 0.7, y: 1.35, w: 8.6, h: 1.35, fontSize: titleFontSize, bold: true,
    color: "FFFFFF", fontFace: "Arial", valign: "bottom",
  });
  s1.addText(`${s.organization} · ${s.businessUnit} · ${s.industry}`, {
    x: 0.7, y: 2.8, w: 8.6, h: 0.5, fontSize: 20, color: "C7DDF5", fontFace: "Arial",
  });
  s1.addText(
    `${s.product} · ${s.deployment} · ${s.horizonYears}-year horizon · ${new Date().toLocaleDateString()}`,
    { x: 0.7, y: 3.4, w: 8.6, h: 0.4, fontSize: 13, color: "93B4DC", fontFace: "Arial" },
  );
  s1.addText("Synthetic data initiative — internal ROI business case", {
    x: 0.7, y: 4.7, w: 8.6, h: 0.3, fontSize: 11, color: "7FA3CE", fontFace: "Arial",
  });

  // 2. Headline KPIs
  const s2 = pptx.addSlide();
  brandMark(s2);
  s2.addText("Headline business case", titleOpts);

  const cards: [string, string][] = [
    ["ROI", formatRoi(r.roi)],
    ["Net benefit", fmt.short(r.netBenefit, cur)],
    ["Payback", formatPayback(r.paybackMonths, r.paybackBeyondHorizon)],
    ["NPV", fmt.short(r.npv, cur)],
    ["Total cost of ownership", fmt.short(r.totalCost, cur)],
    ["Annual value at maturity", fmt.short(r.annualBenefitAtMaturity, cur)],
    ["Adoption assumed", fmt.pct(s.adoptionRate, 0)],
  ];
  cards.forEach(([label, value], i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.6 + col * 2.24;
    const y = 1.5 + row * 1.65;
    const highlight = i === 0 || i === 1;
    s2.addShape(pptx.ShapeType.roundRect, {
      x, y, w: 2.04, h: 1.4, fill: { color: highlight ? INK : LIGHT }, line: { color: highlight ? INK : "D3DEEC" },
      rectRadius: 0.08,
    });
    s2.addText(label.toUpperCase(), {
      x: x + 0.15, y: y + 0.14, w: 1.74, h: 0.3, fontSize: 9, bold: true,
      color: highlight ? "C7DDF5" : MUTED, fontFace: "Arial",
    });
    s2.addText(value, {
      x: x + 0.15, y: y + 0.5, w: 1.74, h: 0.6, fontSize: 20, bold: true,
      color: highlight ? "FFFFFF" : INK, fontFace: "Arial",
    });
  });

  // 3. Value by driver
  const s3 = pptx.addSlide();
  brandMark(s3);
  s3.addText("Where the value comes from", titleOpts);

  if (r.benefitsByDimension.length) {
    s3.addChart(
      pptx.ChartType.bar,
      [
        {
          name: "Annual value",
          labels: r.benefitsByDimension.map((d) => d.label),
          values: r.benefitsByDimension.map((d) => Math.round(d.value)),
        },
      ],
      {
        x: 0.6, y: 1.3, w: 8.8, h: 3.9, barDir: "bar", chartColors: [ACCENT],
        showValue: true, dataLabelFontSize: 9, dataLabelColor: INK,
        catAxisLabelFontSize: 11, valAxisLabelFontSize: 9, showLegend: false,
      },
    );
  } else {
    s3.addText("No value modeled yet.", {
      x: 0.6, y: 2.4, w: 8.8, h: 0.5, fontSize: 16, color: MUTED, fontFace: "Arial",
    });
  }

  // 4. Cost of ownership
  const s4 = pptx.addSlide();
  brandMark(s4);
  s4.addText("Total cost of ownership", titleOpts);

  s4.addTable(
    [
      [
        { text: "Cost line", options: { bold: true, color: "FFFFFF", fill: { color: INK } } },
        { text: "Type", options: { bold: true, color: "FFFFFF", fill: { color: INK } } },
        { text: "Per period", options: { bold: true, color: "FFFFFF", fill: { color: INK }, align: "right" as const } },
        { text: `Over ${s.horizonYears}y`, options: { bold: true, color: "FFFFFF", fill: { color: INK }, align: "right" as const } },
      ],
      ...costRows(s, r).map((row) =>
        row.map((cell, i) => ({ text: cell, options: { align: (i > 1 ? "right" : "left") as "right" | "left" } })),
      ),
    ],
    { x: 0.6, y: 1.25, w: 8.8, fontSize: 10, fontFace: "Arial", color: INK, border: { pt: 0.5, color: "D3DEEC" }, rowH: 0.3 },
  );

  // 5. Cumulative net benefit
  const s5 = pptx.addSlide();
  brandMark(s5);
  s5.addText("Cumulative net benefit", titleOpts);

  s5.addChart(
    pptx.ChartType.line,
    [{ name: "Cumulative net benefit", labels: r.cashflow.map((l) => (l.year === 0 ? "Initial" : `Y${l.year}`)), values: r.cashflow.map((l) => Math.round(l.cumulative)) }],
    {
      x: 0.6, y: 1.25, w: 8.8, h: 3.6, chartColors: [ACCENT], lineSize: 3, lineSmooth: false,
      showLegend: true, legendPos: "b", catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
    },
  );
  s5.addText("Internal business case — figures are illustrative estimates.", {
    x: 0.6, y: 5.05, w: 8.8, h: 0.3, fontSize: 9, color: MUTED, fontFace: "Arial",
  });

  await pptx.writeFile({ fileName: `${fileBase(s)}.pptx` });
}

/* ----------------------------------------------------------------- DOCX */

export async function exportScenarioDocx(s: Scenario, r: Results) {
  const LOGOS = await loadLogos();
  const {
    AlignmentType, BorderStyle, Document, HeadingLevel, ImageRun, Packer, Paragraph, ShadingType, Table,
    TableCell, TableRow, TextRun, WidthType,
  } = await import("docx");

  const CONTENT_W = 9360;
  const border = { style: BorderStyle.SINGLE, size: 1, color: "D3DEEC" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const margins = { top: 80, bottom: 80, left: 120, right: 120 };

  const text = (t: string, opts: { bold?: boolean; color?: string; size?: number } = {}) =>
    new TextRun({ text: t, font: "Arial", size: opts.size ?? 20, bold: opts.bold, color: opts.color });

  const table = (headers: string[], rows: string[][], widths: number[]) =>
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: widths,
      rows: [
        new TableRow({
          // Repeat the header on every page and never split it. Without this a
          // table running past the page break starts mid-row with no header.
          tableHeader: true,
          cantSplit: true,
          children: headers.map((h, i) => new TableCell({
            borders, margins, width: { size: widths[i], type: WidthType.DXA },
            shading: { fill: INK, type: ShadingType.CLEAR },
            children: [new Paragraph({
              alignment: i > 0 ? AlignmentType.RIGHT : AlignmentType.LEFT,
              children: [text(h, { bold: true, color: "FFFFFF" })],
            })],
          })),
        }),
        ...rows.map((row) => new TableRow({
          cantSplit: true,
          children: row.map((cell, i) => new TableCell({
            borders, margins, width: { size: widths[i], type: WidthType.DXA },
            children: [new Paragraph({
              alignment: i > 0 ? AlignmentType.RIGHT : AlignmentType.LEFT,
              children: [text(cell)],
            })],
          })),
        })),
      ],
    });

  const heading = (t: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 320, after: 160 },
      children: [new TextRun({ text: t, font: "Arial", size: 26, bold: true, color: INK })],
    });

  const useCases = buildUseCaseRows(s);

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new ImageRun({
              type: "png", data: toUint8(LOGOS.ydataBlue), transformation: { width: 36, height: 36 },
              altText: { title: "YData", description: "YData logo", name: "YData" },
            }),
            new TextRun({ text: "   " }),
            new ImageRun({
              type: "png", data: toUint8(LOGOS.kpmgBlue), transformation: { width: 86, height: 35 },
              altText: { title: "KPMG", description: "KPMG logo", name: "KPMG" },
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 240 },
          children: [text(`${ENDORSEMENT} KPMG`, { color: MUTED, size: 16 })],
        }),
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: s.name, font: "Arial", size: 40, bold: true, color: INK })],
        }),
        new Paragraph({ children: [text(`${s.organization} · ${s.businessUnit} · ${s.industry}`, { color: MUTED })] }),
        new Paragraph({
          spacing: { after: 200 },
          children: [text(
            `${s.product} · ${s.deployment} · ${s.horizonYears}-year horizon · ${new Date().toLocaleDateString()}`,
            { color: MUTED, size: 18 },
          )],
        }),

        heading("Headline business case"),
        table(["Metric", "Value"], kpiRows(s, r), [6360, 3000]),

        heading("Where the value comes from"),
        table(["Value driver", `Annual value at maturity (${s.currency})`], dimensionRows(s, r), [6360, 3000]),

        heading("Use cases"),
        table(
          ["Use case", "Value driver", "Annual value", "Confidence", "Risk-adjusted"],
          useCases.length ? useCases : [["No use cases enabled", "—", "—", "—", "—"]],
          [2760, 1800, 1620, 1560, 1620],
        ),

        heading("Total cost of ownership"),
        table(["Cost line", "Type", "Per period", `Over ${s.horizonYears}y`], costRows(s, r), [3600, 1600, 2080, 2080]),

        heading("Cash flow"),
        table(["Period", "Benefits", "Costs", "Net", "Cumulative"], cashflowRows(s, r), [1560, 1950, 1950, 1950, 1950]),

        new Paragraph({
          spacing: { before: 320 },
          children: [text("Internal business case — figures are illustrative estimates.", { color: MUTED, size: 16 })],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase(s)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}


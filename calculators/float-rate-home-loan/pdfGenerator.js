// ============================================================
// Floating Rate Home Loan PDF Generator - pdfGenerator.js
// KnowYourEMI.in  |  Same pattern as main site PDF
// ============================================================

function pdfGeneratorFloat(dataForPdf, events, loanInfo = {}) {
  if (!dataForPdf || !Array.isArray(dataForPdf)) {
    alert("No amortization data available to generate PDF.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "pt", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();

  // ---- Utility: draw 2-col summary table rows ----
  function drawSummaryTable(startX, startY, width, rows) {
    const rowHeight = 22;
    const labelX = startX + 20;
    const valueX = startX + width - 180;
    doc.setLineWidth(0.5);
    rows.forEach(([label, value]) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(60);
      doc.text(label, labelX, startY);
      doc.text(value, valueX, startY);
      startY += rowHeight;
    });
    doc.setLineDash([]);
    return startY;
  }

  let startY = 110;

  // ============================================================
  // HEADER BAR (dark blue)
  // ============================================================
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, pageWidth, 60, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("Floating Rate Home Loan Simulator", pageWidth / 2, 25, { align: "center" });

  // Tagline with link
  const centerX = pageWidth / 2;
  const prefix = "Generated using Know Your EMI Calculator – ";
  const linkText = "knowyouremi.in";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const prefixWidth = doc.getTextWidth(prefix);
  const totalWidth = prefixWidth + doc.getTextWidth(linkText);
  const startX0 = centerX - totalWidth / 2;

  doc.setTextColor(255, 255, 255);
  doc.text(prefix, startX0 - 5, 45);

  const linkX = startX0 + prefixWidth;
  doc.setTextColor(251, 250, 77);
  doc.setFont("helvetica", "bold");
  doc.text(linkText, linkX, 45);
  const linkWidth = doc.getTextWidth(linkText);
  doc.setDrawColor(251, 250, 77);
  doc.setLineWidth(0.5);
  doc.line(linkX, 47, linkX + linkWidth, 47);
  doc.link(linkX, 35, linkWidth, 15, { url: "https://www.knowyouremi.in" });

  // ============================================================
  // LOAN SUMMARY BOX
  // ============================================================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 64, 175);
  doc.text("Loan Summary", 40, startY);

  startY += 20;
  doc.setDrawColor(140, 170, 220);
  doc.setFillColor(220, 235, 255);
  doc.roundedRect(40, startY, pageWidth - 80, 140, 6, 6, "FD");
  startY += 30;

  const loanSummaryRows = [
    ["Loan Type",       "Home Loan (Floating Rate)"],
    ["Loan Amount",     "Rs. " + (loanInfo.amount || 0).toLocaleString("en-IN")],
    ["Starting Rate",   (loanInfo.interestRate || 0) + "% per annum"],
    ["Original Tenure", (loanInfo.tenure || 0) + " months"],
    ["Monthly EMI",     "Rs. " + (loanInfo.emi || 0).toLocaleString("en-IN")],
    ["Actual Duration", dataForPdf.length + " months (after events)"],
  ];

  startY = drawSummaryTable(40, startY, pageWidth - 17, loanSummaryRows);
  startY += 30;

  // ============================================================
  // EVENTS SUMMARY (if any events exist)
  // ============================================================
  if (events && events.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 64, 175);
    doc.text("Events Applied", 40, startY);
    startY += 20;

    events.forEach((ev, idx) => {
      const match = dataForPdf.find(m => m.serial === ev.month);
      let monthLabel = `Month ${ev.month}`;
      if (match) {
        const mName = new Date(match.year, match.month - 1)
          .toLocaleString("default", { month: "long" });
        monthLabel = `${mName} ${match.year} (Month ${ev.month})`;
      }

      const parts = [];
      if (ev.newRoi !== null && ev.newRoi !== "") parts.push(`Rate changed to ${ev.newRoi}% p.a.`);
      if (ev.amount > 0) parts.push(`Part payment of Rs. ${Number(ev.amount).toLocaleString("en-IN")}`);
      const optionLabel = ev.option === "reduceEmi" ? "Reduce EMI" : "Reduce Tenure";

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(60);
      doc.text(`${idx + 1}. ${monthLabel}`, 55, startY);
      startY += 16;
      doc.setTextColor(100);
      doc.text(`   ${parts.join(" + ")}  |  Option: ${optionLabel}`, 55, startY, {
        maxWidth: pageWidth - 110
      });
      startY += 22;
    });

    startY += 10;

    // ---- Interest Comparison Box ----
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 64, 175);
    doc.text("Interest Comparison", 40, startY);

    startY += 15;
    doc.setDrawColor(140, 170, 220);
    doc.setFillColor(220, 235, 255);
    doc.roundedRect(40, startY, pageWidth - 80, 90, 6, 6, "FD");
    startY += 25;

    const origInt  = Math.round(loanInfo.originalInterest || 0);
    const newInt   = Math.round(loanInfo.newInterest || 0);
    const saved    = Math.max(origInt - newInt, 0);

    const compRows = [
      ["Total Interest (Original Schedule)",     "Rs. " + origInt.toLocaleString("en-IN")],
      ["Total Interest (After All Events)",       "Rs. " + newInt.toLocaleString("en-IN")],
    ];
    startY = drawSummaryTable(40, startY, pageWidth - 17, compRows);

    // Savings highlight
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 128, 0);
    doc.text("Total Interest Saved:", 60, startY);
    doc.text("Rs. " + saved.toLocaleString("en-IN"), pageWidth - 290, startY);
    startY += 30;

    // Important notes (same as main site)
    startY += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(200, 0, 0);
    doc.text("Important Notes:", 40, startY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60);
    startY += 20;
    const notes = [
      "The revised EMI schedule may differ slightly, as banks may apply additional charges such as part-payment fees and GST. These are not included in this model.",
      "Rate changes are illustrative. Actual rate reset timing depends on your bank's reset clause (typically quarterly or annually).",
      "Please use this tool for illustration and planning purposes only."
    ];
    notes.forEach(note => {
      doc.text("• " + note, 60, startY, {
        maxWidth: pageWidth - 100,
        align: "left"
      });
      startY += 28;
    });
    startY += 20;
  } else {
    // No events - simple repayment summary
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 64, 175);
    doc.text("Repayment Summary", 40, startY);

    startY += 15;
    doc.setDrawColor(140, 170, 220);
    doc.setFillColor(220, 235, 255);
    doc.roundedRect(40, startY, pageWidth - 80, 70, 6, 6, "FD");
    startY += 25;

    const repRows = [
      ["Total Interest",  "Rs. " + Math.round(loanInfo.totalInterest || 0).toLocaleString("en-IN")],
      ["Total Payments",  "Rs. " + Math.round(loanInfo.totalPayment || 0).toLocaleString("en-IN")],
    ];

    repRows.forEach(([label, value]) => {
      const isTotal = label === "Total Payments";
      doc.setFont("helvetica", isTotal ? "bold" : "normal");
      doc.setFontSize(11);
      doc.setTextColor(isTotal ? 30 : 220, isTotal ? 64 : 38, isTotal ? 175 : 38);
      doc.text(label, 60, startY);
      doc.text(value, pageWidth - 290, startY);
      startY += 22;
    });
    startY += 30;
  }

  // ============================================================
  // AMORTIZATION SCHEDULE TABLE
  // ============================================================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 64, 175);
  doc.text("Amortization Schedule", pageWidth / 2, startY, { align: "center" });
  startY += 15;

  const headers = ["S.No", "Month", "Rate%", "EMI", "Interest", "Principal", "Balance"];
  const rows = [];

  dataForPdf.forEach(m => {
    const mName = new Date(m.year, m.month - 1)
      .toLocaleString("default", { month: "short" });

    const rate = m.currentRate || loanInfo.interestRate;

    rows.push([
      m.serial,
      `${mName} ${m.year}`,
      rate ? rate.toFixed(2) + "%" : "-",
      "Rs. " + Math.round(m.emi).toLocaleString("en-IN"),
      "Rs. " + Math.round(m.interest).toLocaleString("en-IN"),
      "Rs. " + Math.round(m.principal).toLocaleString("en-IN"),
      "Rs. " + Math.round(m.balance).toLocaleString("en-IN"),
    ]);

    if (m.note) {
      rows.push([{
        content: m.note,
        colSpan: 7,
        styles: {
          font: "helvetica",
          halign: "left",
          fontSize: 9,
          textColor: [255, 255, 255],
          fillColor: [30, 64, 175]
        }
      }]);
    }
  });

  doc.autoTable({
    head: [headers],
    body: rows,
    startY,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 4,
      valign: "middle",
    },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      halign: "center",
    },
    bodyStyles: { textColor: [50, 50, 50] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { halign: "center", cellWidth: 35 },
      1: { cellWidth: 70 },
      2: { halign: "center", cellWidth: 42 },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    }
  });

  const finalY = doc.lastAutoTable.finalY + 20;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text("-- End of Schedule --", pageWidth / 2, finalY, { align: "center" });

  // ============================================================
  // PAGE NUMBERS
  // ============================================================
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() - 40,
      doc.internal.pageSize.getHeight() - 20,
      { align: "right" }
    );
  }

  doc.save("floating-rate-home-loan.pdf");
}

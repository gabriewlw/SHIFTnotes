import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
export async function exportPDF(element, title, brand) {
  const canvas = await html2canvas(element, {
    scale: 1.7,
    backgroundColor: "#ffffff",
    logging: false,
    onclone(doc) {
      doc.querySelectorAll("[data-export-hide]").forEach((el) => el.remove());
      doc
        .querySelectorAll(".floating-image")
        .forEach((el) => el.classList.remove("selected"));
    },
  });
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const width = 186,
    height = 255,
    sliceHeight = Math.floor((height * canvas.width) / width);
  const count = Math.ceil(canvas.height / sliceHeight);
  for (let page = 0; page < count; page++) {
    if (page) pdf.addPage();
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.min(sliceHeight, canvas.height - page * sliceHeight);
    slice
      .getContext("2d")
      .drawImage(
        canvas,
        0,
        page * sliceHeight,
        canvas.width,
        slice.height,
        0,
        0,
        canvas.width,
        slice.height,
      );
    pdf.setFillColor(brand.primary);
    pdf.rect(0, 0, 210, 14, "F");
    pdf.setTextColor("#ffffff");
    pdf.setFontSize(9);
    pdf.text(brand.name, 12, 9);
    pdf.setFontSize(7);
    pdf.text("TECHNICAL DOCUMENTATION", 198, 9, { align: "right" });
    pdf.addImage(
      slice.toDataURL("image/png"),
      "PNG",
      12,
      20,
      width,
      (slice.height * width) / canvas.width,
    );
    pdf.setDrawColor(brand.accent);
    pdf.line(12, 282, 198, 282);
    pdf.setTextColor("#7c8585");
    pdf.setFontSize(7);
    pdf.text(title.slice(0, 85), 12, 288);
    pdf.text(`${page + 1} / ${count}`, 198, 288, { align: "right" });
  }
  pdf.save(
    `${title.replace(/[^a-z0-9 -]/gi, "").trim() || "SHIFTnotes document"}.pdf`,
  );
}

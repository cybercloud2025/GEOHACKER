import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";

// Function to generate the PDF
async function generatePDF() {
    try {
        const doc = new jsPDF();
        const markdownPath = path.resolve("GEOHACKER_RESUMEN.md");
        const markdownContent = fs.readFileSync(markdownPath, "utf-8");

        const lines = markdownContent.split("\n");
        let y = 20; // Initial Y position
        const lineHeight = 7;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;
        const maxWidth = doc.internal.pageSize.width - margin * 2;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);

        lines.forEach((line) => {
            // Check for page break
            if (y > pageHeight - margin) {
                doc.addPage();
                y = 20;
            }

            line = line.trim();

            if (line.startsWith("# ")) {
                // H1
                doc.setFont("helvetica", "bold");
                doc.setFontSize(20);
                const text = line.replace("# ", "");
                const splitText = doc.splitTextToSize(text, maxWidth);
                doc.text(splitText, margin, y);
                y += lineHeight * 2;
                doc.setFont("helvetica", "normal"); // Reset
                doc.setFontSize(12);
            } else if (line.startsWith("## ")) {
                // H2
                doc.setFont("helvetica", "bold");
                doc.setFontSize(16);
                y += 5; // Extra space before H2
                const text = line.replace("## ", "");
                const splitText = doc.splitTextToSize(text, maxWidth);
                doc.text(splitText, margin, y);
                y += lineHeight * 1.5;
                doc.setFont("helvetica", "normal"); // Reset
                doc.setFontSize(12);
            } else if (line.startsWith("### ")) {
                // H3
                doc.setFont("helvetica", "bold");
                doc.setFontSize(14);
                const text = line.replace("### ", "");
                const splitText = doc.splitTextToSize(text, maxWidth);
                doc.text(splitText, margin, y);
                y += lineHeight * 1.5;
                doc.setFont("helvetica", "normal"); // Reset
                doc.setFontSize(12);
            } else if (line.startsWith("- ") || line.startsWith("* ")) {
                // List item
                const text = "• " + line.substring(2);
                const splitText = doc.splitTextToSize(text, maxWidth);
                doc.text(splitText, margin, y);
                y += lineHeight * splitText.length;
            } else if (line === "") {
                // Empty line
                y += lineHeight / 2;
            } else if (line.startsWith("|")) {
                // Skip tables for simple text rendering or handle simply
                // For now, just print the row content
                const text = line;
                const splitText = doc.splitTextToSize(text, maxWidth);
                doc.setFont("courier", "normal"); // Monospace for tables
                doc.text(splitText, margin, y);
                y += lineHeight * splitText.length;
                doc.setFont("helvetica", "normal");
            } else {
                // Normal paragraph
                // Handle bolding **text** roughly by removing it or keeping it
                // Ideally we parse it, but for simple output, let's just strip **
                const cleanLine = line.replace(/\*\*/g, "");
                const splitText = doc.splitTextToSize(cleanLine, maxWidth);
                doc.text(splitText, margin, y);
                y += lineHeight * splitText.length;
            }
        });

        const outputPath = path.resolve("GEOHACKER_APP_INFO.pdf");
        doc.save(outputPath);
        console.log(`PDF successfully generated at: ${outputPath}`);
    } catch (error) {
        console.error("Error generating PDF:", error);
    }
}

generatePDF();

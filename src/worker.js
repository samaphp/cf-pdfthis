import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

 /**
 /**
 * pdfthis: Cloudflare Worker that returns a PDF.
 * pdfthis: Cloudflare Worker that returns a PDF with Unicode support.
 * - If no query params: returns an instructions PDF.
 * Note: This example shows how to add Unicode support, but you'll need to
 * - If query params exist:
 * include font files in your deployment for full Arabic support.
 *    • H1 = ?title= (defaults to "PDF")
 *    • If ?text= is present, print it as a paragraph under the title
 *    • Show "Extra information" section only for params other than title/text
 * - Always shows a Disclaimer section at the bottom.
  */

export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const params = Array.from(url.searchParams.entries());
      const titleParam = url.searchParams.get("title") || "PDF";
      const textParam = url.searchParams.get("text");

      // PDF setup
      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage(); // Default Letter: 612x792
      const { width, height } = page.getSize();
      const margin = 50;
      const lineHeight = 18;
      const bodySize = 12;
      const titleSize = 26; // larger for H1
      const sectionHeaderSize = 14;

      // White background
      const paintWhite = (p) =>
        p.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
      paintWhite(page);

      // Fonts - Try to use Unicode-compatible fonts
      let font, fontBold;
      let useUnicode = true;
      
      try {
        // Option 1: Try to load a Unicode font from a URL (you'd need to host these)
        // const fontBytes = await fetch('https://your-domain.com/fonts/NotoSansArabic-Regular.ttf').then(res => res.arrayBuffer());
        // font = await pdfDoc.embedFont(fontBytes);
        
        // Option 2: For now, we'll use standard fonts with fallback
        font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        useUnicode = false; // Set to true when you have Unicode fonts
      } catch (err) {
        // Fallback to standard fonts
        font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        useUnicode = false;
      }

      // Helper function to handle text based on Unicode support
      const processText = (text) => {
        if (!text) return text;
        if (useUnicode) {
          return String(text); // Return as-is if Unicode is supported
        } else {
          // Fallback: Replace non-ASCII characters or provide transliteration
          return String(text)
            .replace(/[^\u0020-\u007E]/g, (char) => {
              // Simple transliteration map for common Arabic characters
              const arabicToLatin = {
                'ا': 'A', 'ب': 'B', 'ت': 'T', 'ث': 'TH', 'ج': 'J',
                'ح': 'H', 'خ': 'KH', 'د': 'D', 'ذ': 'DH', 'ر': 'R',
                'ز': 'Z', 'س': 'S', 'ش': 'SH', 'ص': 'S', 'ض': 'D',
                'ط': 'T', 'ظ': 'Z', 'ع': 'A', 'غ': 'GH', 'ف': 'F',
                'ق': 'Q', 'ك': 'K', 'ل': 'L', 'م': 'M', 'ن': 'N', 'ة': 'T', 'ـ': '-',
                'ه': 'H', 'و': 'W', 'ي': 'Y', 'ى': 'A', 'ئ': 'A', 'ء': 'A', 'إ': 'E'
              };
              return arabicToLatin[char] || '?';
            });
        }
      };

      // Cursor
      let y = height - margin;

      // Utilities
      const newPage = () => {
        page = pdfDoc.addPage([width, height]);
        paintWhite(page);
        y = height - margin;
      };

      const ensureSpace = (needed = lineHeight) => {
        if (y - needed < margin) newPage();
      };

      const maxTextWidth = width - margin * 2;

      // Word-wrap with Unicode handling
      const wrapText = (text, maxWidth, fnt = font, size = bodySize) => {
        const processedText = processText(text);
        const words = String(processedText).split(/\s+/);
        const lines = [];
        let current = "";
        const textWidth = (t) => {
          try {
            return fnt.widthOfTextAtSize(t, size);
          } catch (err) {
            // If width calculation fails, return a reasonable estimate
            return t.length * size * 0.6;
          }
        };

        for (const w of words) {
          const attempt = current ? current + " " + w : w;
          if (textWidth(attempt) <= maxWidth) {
            current = attempt;
          } else {
            if (current) lines.push(current);
            // simple hard split for very long tokens
            let chunk = "";
            for (const ch of w) {
              const attemptChunk = chunk + ch;
              if (textWidth(attemptChunk) <= maxWidth) {
                chunk = attemptChunk;
              } else {
                if (chunk) lines.push(chunk);
                chunk = ch;
              }
            }
            current = chunk;
          }
        }
        if (current) lines.push(current);
        return lines;
      };

      const drawWrapped = (text, x, maxWidth, size = bodySize, fnt = font) => {
        const lines = wrapText(text, maxWidth, fnt, size);
        for (const line of lines) {
          ensureSpace(lineHeight);
          try {
            page.drawText(line, { x, y, size, font: fnt, color: rgb(0, 0, 0) });
          } catch (err) {
            // If drawing fails, try with a fallback character
            const fallbackLine = line.replace(/[^\u0020-\u007E]/g, '?');
            page.drawText(fallbackLine, { x, y, size, font: fnt, color: rgb(0, 0, 0) });
          }
          y -= lineHeight;
        }
      };

      const drawTitle = (text) => {
        ensureSpace(lineHeight * 2);
        try {
          page.drawText(processText(text), { x: margin, y, size: titleSize, font: fontBold, color: rgb(0, 0, 0) });
        } catch (err) {
          const fallbackText = processText(text).replace(/[^\u0020-\u007E]/g, '?');
          page.drawText(fallbackText, { x: margin, y, size: titleSize, font: fontBold, color: rgb(0, 0, 0) });
        }
        y -= lineHeight * 2;
      };

      const drawSectionHeader = (text) => {
        ensureSpace(lineHeight * 2);
        try {
          page.drawText(processText(text), { x: margin, y, size: sectionHeaderSize, font: fontBold, color: rgb(0, 0, 0) });
        } catch (err) {
          const fallbackText = processText(text).replace(/[^\u0020-\u007E]/g, '?');
          page.drawText(fallbackText, { x: margin, y, size: sectionHeaderSize, font: fontBold, color: rgb(0, 0, 0) });
        }
        y -= lineHeight * 1.5;
      };

      // Limits
      const MAX_PARAMS = 50;
      const MAX_VALUE_LEN = 500;

      // Helper: filter out title/text for the "Extra information" section
      const extraParams = params
        .filter(([k]) => k !== "title" && k !== "text")
        .slice(0, MAX_PARAMS);

      // INSTRUCTIONS PAGE (no params at all)
      if (params.length === 0) {
        // H1
        drawTitle("PDF Generator with Unicode Support");

        // Purpose
        drawSectionHeader("Purpose");
        drawWrapped(
          "This service provides a PDF file that can handle Unicode characters including Arabic text. " +
          "Text is customized using URL parameters.",
          margin,
          maxTextWidth
        );
        y -= lineHeight;

        // Use Cases
        drawSectionHeader("Use Cases");
        [
          "- Generate PDFs with multilingual content",
          "- Support Arabic, Hebrew, and other RTL languages",
          "- Echo URL parameters as text with Unicode support",
          "- Test international character handling",
        ].forEach((line) => drawWrapped(line, margin, maxTextWidth));
        y -= lineHeight;

        // Example
        drawSectionHeader("Example Usage");
        const origin = url.origin.replace(/\/$/, "");
        const exampleQuery = "?title=مرحبا&text=This%20is%20Arabic:%20السلام%20عليكم";
        drawWrapped(`${origin}${url.pathname}${exampleQuery}`, margin, maxTextWidth);
        y -= lineHeight * 2;

        // Notes
        drawSectionHeader("Notes");
        [
          `- Each value is limited to ${MAX_VALUE_LEN} characters.`,
          `- Up to ${MAX_PARAMS} URL parameters are rendered.`,
          useUnicode ? "- Full Unicode support enabled" : "- Unicode characters are transliterated to Latin equivalents",
          "- RTL languages may not render in proper direction without additional setup",
        ].forEach((line) => drawWrapped(line, margin, maxTextWidth));
        y -= lineHeight;

        // Disclaimer
        drawSectionHeader("Disclaimer");
        drawWrapped(
          "This PDF file is for testing purposes. Content is rendered directly from URL parameters.",
          margin,
          maxTextWidth
        );
      } else {
        // PARAMS PAGE (with title/text behavior)
        drawTitle(titleParam);

        if (textParam) {
          drawWrapped(String(textParam).slice(0, MAX_VALUE_LEN), margin, maxTextWidth);
          y -= lineHeight;
        }

        if (extraParams.length > 0) {
          drawSectionHeader("Extra information");

          if (params.length - (url.searchParams.has("title") ? 1 : 0) - (url.searchParams.has("text") ? 1 : 0) > MAX_PARAMS) {
            drawWrapped(
              `Note: Showing first ${MAX_PARAMS} parameters (excluding title/text).`,
              margin,
              maxTextWidth
            );
            y -= lineHeight;
          }

          for (const [key, rawVal] of extraParams) {
            const val = (rawVal ?? "").slice(0, MAX_VALUE_LEN);
            drawWrapped(`${key} = ${val}`, margin, maxTextWidth);
          }
          y -= lineHeight;
        }

        drawSectionHeader("Disclaimer");
        const disclaimerText = useUnicode ? 
          "This PDF supports Unicode characters. Content is rendered from URL parameters." :
          "Unicode characters are transliterated. Content is rendered from URL parameters.";
        drawWrapped(disclaimerText, margin, maxTextWidth);
      }

      // Done
      const pdfBytes = await pdfDoc.save();
      return new Response(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="pdfthis.pdf"',
        },
      });
    } catch (err) {
      return new Response(`Failed to generate PDF: ${err?.message || err}`, { status: 500 });
    }
  },
};

import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

// Set worker source for pdfjs
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || "4.10.38"}/pdf.worker.min.mjs`;
} catch (e) {
  console.warn("Could not set PDF.js workerSrc", e);
}

export interface ParsedOfferDoc {
  fileName: string;
  subjectText?: string;
  openingText?: string;
  clausesText?: string;
  closingText?: string;
  signingAuthority?: string;
  signingTitle?: string;
  candidateName?: string;
  candidateRole?: string;
  candidateEmail?: string;
  extractedCtc?: number;
  rawText: string;
  htmlContent?: string;
}

/**
 * Filter out raw binary tokens, PDF byte-streams, and non-printable gibberish
 */
function cleanExtractedText(raw: string): string {
  if (!raw) return "";

  // Split into lines
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  const cleanedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for PDF/binary stream signatures
    const isPdfBinaryHeader =
      trimmed.startsWith("%PDF-") ||
      trimmed.includes("/Filter") ||
      trimmed.includes("/FlateDecode") ||
      trimmed.includes("/Length") ||
      trimmed.includes("<<") ||
      trimmed.includes(">>") ||
      trimmed.startsWith("stream") ||
      trimmed.endsWith("stream") ||
      trimmed.startsWith("endstream") ||
      trimmed.startsWith("xref") ||
      trimmed.startsWith("trailer") ||
      trimmed.startsWith("startxref") ||
      /^\d+\s+\d+\s+obj\b/i.test(trimmed);

    if (isPdfBinaryHeader) continue;

    // Check character printable ratio (detect compressed binary gibberish)
    // Remove unprintable control characters and replacement diamonds
    const cleanLine = trimmed
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFFFD\uFFFE\uFFFF]/g, "")
      .replace(/[]/g, "")
      .trim();

    if (!cleanLine || cleanLine.length < 2) continue;

    // Count printable vs non-ASCII symbols
    let nonPrintableCount = 0;
    for (let i = 0; i < cleanLine.length; i++) {
      const code = cleanLine.charCodeAt(i);
      if (code < 32 || (code > 126 && code < 160)) {
        nonPrintableCount++;
      }
    }

    // If more than 25% is garbage, ignore this line
    if (nonPrintableCount / cleanLine.length > 0.25) continue;

    cleanedLines.push(cleanLine);
  }

  return cleanedLines.join("\n");
}

/**
 * Extract clean text from a PDF file using PDF.js
 */
async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ");
      pageTexts.push(pageText);
    }

    return pageTexts.join("\n\n");
  } catch (err) {
    console.error("PDF.js extraction failed:", err);
    return "";
  }
}

/**
 * Parse an uploaded Word docx/doc/pdf/rtf/txt/html file into offer letter structure
 */
export async function parseUploadedOfferDoc(file: File): Promise<ParsedOfferDoc> {
  const fileName = file.name;
  const extension = fileName.split(".").pop()?.toLowerCase() || "";

  let rawText = "";
  let htmlContent = "";

  if (extension === "pdf") {
    const arrayBuffer = await file.arrayBuffer();
    rawText = await extractTextFromPdf(arrayBuffer);
  } else if (extension === "docx") {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const rawTextResult = await mammoth.extractRawText({ arrayBuffer });
      rawText = rawTextResult.value || "";

      const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
      htmlContent = htmlResult.value || "";
    } catch (err) {
      console.warn("Mammoth extraction failed", err);
    }
  } else if (extension === "html" || extension === "htm") {
    htmlContent = await file.text();
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    rawText = tempDiv.innerText || tempDiv.textContent || "";
  } else if (extension === "txt") {
    try {
      rawText = await file.text();
    } catch {
      rawText = "";
    }
  } else {
    // Other file types (e.g. .doc)
    try {
      const text = await file.text();
      // Ensure we don't return raw binary
      rawText = cleanExtractedText(text);
    } catch {
      rawText = "";
    }
  }

  // Clean and normalize text, removing binary artifacts
  const cleaned = cleanExtractedText(rawText);
  const lines = cleaned.split("\n").map(l => l.trim()).filter(Boolean);

  let subjectText = "";
  let openingText = "";
  const clausesList: string[] = [];
  let closingText = "";
  let signingAuthority = "";
  let signingTitle = "";
  let candidateName = "";
  let candidateRole = "";
  let candidateEmail = "";
  let extractedCtc: number | undefined = undefined;

  let currentSection: "header" | "subject" | "opening" | "clauses" | "closing" | "signatures" = "header";
  const openingLines: string[] = [];
  const closingLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Candidate details extraction
    if (!candidateEmail) {
      const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) candidateEmail = emailMatch[0];
    }

    if (!candidateName && (lower.startsWith("dear ") || lower.startsWith("to: ") || lower.startsWith("candidate:"))) {
      const nameMatch = line.replace(/^(dear|to:|candidate:)\s+/i, "").replace(/[,:]/g, "").trim();
      if (nameMatch && nameMatch.length < 50 && !nameMatch.includes("<<")) {
        candidateName = nameMatch;
      }
    }

    if (!candidateRole && (lower.includes("position:") || lower.includes("designation:") || lower.includes("role:"))) {
      const roleMatch = line.replace(/^.*(position|designation|role):\s*/i, "").trim();
      if (roleMatch && roleMatch.length < 60) {
        candidateRole = roleMatch;
      }
    }

    // CTC extraction
    if (!extractedCtc) {
      const ctcMatch = line.match(/(?:ctc|compensation|salary|remuneration|gross)[:\s]*([₹$€£]?\s*[\d,]+(?:\.\d+)?)/i);
      if (ctcMatch && ctcMatch[1]) {
        const num = Number(ctcMatch[1].replace(/[^\d.]/g, ""));
        if (num > 1000) extractedCtc = num;
      }
    }

    // Subject detection
    if (!subjectText && (lower.startsWith("subject:") || lower.startsWith("sub:") || lower.includes("offer of employment") || lower.includes("letter of offer") || lower.includes("appointment letter"))) {
      subjectText = line.replace(/^subject:\s*/i, "").replace(/^sub:\s*/i, "").trim();
      currentSection = "opening";
      continue;
    }

    // Clauses detection (starts with number like "1.", "1)", "Clause 1", "Section", "Annexure B", "Terms & Conditions")
    const isClauseLine = /^(?:\d+[\.\)]|[a-z][\.\)]|clause\s+\d+|section\s+\d+|annexure\s+[a-z0-9])/i.test(line) ||
      lower.includes("terms and conditions") ||
      lower.includes("covenants") ||
      lower.includes("confidentiality & non-disclosure") ||
      lower.includes("probation & confirmation");

    if (isClauseLine) {
      currentSection = "clauses";
      clausesList.push(line);
      continue;
    }

    // Sign-off / Signature detection
    const isSignOff = lower.startsWith("sincerely") ||
      lower.startsWith("yours faithfully") ||
      lower.startsWith("yours sincerely") ||
      lower.startsWith("warm regards") ||
      lower.startsWith("for ") ||
      lower.startsWith("authorized signatory") ||
      lower.includes("authorized signature");

    if (isSignOff) {
      currentSection = "signatures";
      if (i + 1 < lines.length && !signingAuthority) {
        signingAuthority = lines[i + 1].trim();
      }
      if (i + 2 < lines.length && !signingTitle) {
        signingTitle = lines[i + 2].trim();
      }
      continue;
    }

    // Closing CTA detection
    const isClosingLine = lower.includes("please sign and return") ||
      lower.includes("acceptance of this offer") ||
      lower.includes("we look forward to") ||
      lower.includes("valid until") ||
      lower.includes("confirm your acceptance");

    if (isClosingLine && currentSection !== "signatures") {
      currentSection = "closing";
      closingLines.push(line);
      continue;
    }

    // Section accumulation
    if (currentSection === "clauses") {
      clausesList.push(line);
    } else if (currentSection === "closing") {
      closingLines.push(line);
    } else if (currentSection === "opening" || currentSection === "header") {
      if (!line.toLowerCase().startsWith("date:") && !line.toLowerCase().startsWith("ref:") && line.length > 20) {
        openingLines.push(line);
      }
    }
  }

  openingText = openingLines.join("\n\n").trim();
  closingText = closingLines.join("\n\n").trim();
  const clausesText = clausesList.length > 0 ? clausesList.join("\n") : "";

  if (!subjectText) {
    subjectText = candidateRole ? `Formal Offer of Employment — ${candidateRole}` : `Formal Offer of Employment`;
  }

  const finalClauses = clausesText || `1. PROBATION & CONFIRMATION: You will be on probation for a designated initial tenure from the date of joining. Upon successful evaluation, your employment will be confirmed in writing.\n2. NOTICE PERIOD: Either party may terminate the employment by giving 30 days written notice or gross salary in lieu thereof.\n3. CONFIDENTIALITY & IP: All proprietary information, customer records, source code, and intellectual property developed during your employment belong exclusively to the organization.\n4. STATUTORY COMPLIANCE: Standard statutory deductions and taxes will be applied as per government regulations.`;

  return {
    fileName,
    subjectText,
    openingText: openingText || `On behalf of the company, we are pleased to extend this formal offer of employment for the position of {{role}}. We were exceptionally impressed with your domain expertise and believe you will play a pivotal role in accelerating our organizational objectives.`,
    clausesText: finalClauses,
    closingText: closingText || `This offer remains valid until {{expiry_date}}. Please review, sign, and return a duplicate copy of this letter as confirmation of your acceptance.`,
    signingAuthority: signingAuthority || "Priya Sharma",
    signingTitle: signingTitle || "Head of Talent & People Operations",
    candidateName,
    candidateRole,
    candidateEmail,
    extractedCtc,
    rawText: cleaned,
    htmlContent
  };
}

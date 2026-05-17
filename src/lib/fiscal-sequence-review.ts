export interface SequenceReviewDocument {
  id: string;
  type: string;
  invoice_number: string;
  fiscal_year: string | null;
  document_serial: number | null;
}

export interface SequenceReviewIssue {
  type: "gap" | "duplicate" | "missing_fiscal_year" | "missing_serial" | "legacy_review";
  document_type: string;
  fiscal_year: string;
  serial: number | null;
  invoice_number?: string;
  message: string;
}

const REVIEWED_TYPES = ["sale", "purchase", "quotation", "sale_return", "purchase_return"];

function typeLabel(type: string): string {
  if (type === "sale_return") return "credit note";
  if (type === "purchase_return") return "debit note";
  return type;
}

export function analyzeFiscalSequences(documents: SequenceReviewDocument[]): SequenceReviewIssue[] {
  const issues: SequenceReviewIssue[] = [];
  const grouped = new Map<string, SequenceReviewDocument[]>();

  for (const doc of documents.filter((entry) => REVIEWED_TYPES.includes(entry.type))) {
    if (!doc.fiscal_year) {
      issues.push({
        type: "missing_fiscal_year",
        document_type: doc.type,
        fiscal_year: "unknown",
        serial: doc.document_serial,
        invoice_number: doc.invoice_number,
        message: `${doc.invoice_number} needs accountant review because fiscal year metadata is missing.`,
      });
    }
    if (doc.document_serial == null) {
      issues.push({
        type: "missing_serial",
        document_type: doc.type,
        fiscal_year: doc.fiscal_year || "unknown",
        serial: null,
        invoice_number: doc.invoice_number,
        message: `${doc.invoice_number} needs accountant review because serial metadata is missing.`,
      });
    }
    if (!doc.fiscal_year || doc.document_serial == null) {
      issues.push({
        type: "legacy_review",
        document_type: doc.type,
        fiscal_year: doc.fiscal_year || "unknown",
        serial: doc.document_serial,
        invoice_number: doc.invoice_number,
        message: `${doc.invoice_number} is retained as-is; do not renumber without accountant approval.`,
      });
      continue;
    }

    const key = `${doc.type}:${doc.fiscal_year}`;
    grouped.set(key, [...(grouped.get(key) || []), doc]);
  }

  for (const [key, docs] of grouped) {
    const [documentType, fiscalYear] = key.split(":");
    const bySerial = new Map<number, SequenceReviewDocument[]>();
    for (const doc of docs) {
      bySerial.set(doc.document_serial!, [...(bySerial.get(doc.document_serial!) || []), doc]);
    }

    for (const [serial, serialDocs] of bySerial) {
      if (serialDocs.length > 1) {
        issues.push({
          type: "duplicate",
          document_type: documentType,
          fiscal_year: fiscalYear,
          serial,
          invoice_number: serialDocs.map((doc) => doc.invoice_number).join(", "),
          message: `Duplicate ${typeLabel(documentType)} serial ${serial} in fiscal year ${fiscalYear}.`,
        });
      }
    }

    const serials = Array.from(bySerial.keys()).sort((a, b) => a - b);
    for (let index = 1; index < serials.length; index += 1) {
      const previous = serials[index - 1];
      const current = serials[index];
      for (let missing = previous + 1; missing < current; missing += 1) {
        issues.push({
          type: "gap",
          document_type: documentType,
          fiscal_year: fiscalYear,
          serial: missing,
          message: `Missing ${typeLabel(documentType)} serial ${missing} in fiscal year ${fiscalYear}; review before filing.`,
        });
      }
    }
  }

  return issues.sort((a, b) =>
    a.document_type.localeCompare(b.document_type) ||
    a.fiscal_year.localeCompare(b.fiscal_year) ||
    Number(a.serial || 0) - Number(b.serial || 0) ||
    a.type.localeCompare(b.type)
  );
}

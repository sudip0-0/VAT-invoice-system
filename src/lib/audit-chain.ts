export interface AuditHashInput {
  business_id: string;
  invoice_id: string;
  action: string;
  details?: string | null;
  created_at: string;
  previous_hash?: string | null;
}

function stableAuditPayload(input: AuditHashInput): string {
  return JSON.stringify({
    business_id: input.business_id,
    invoice_id: input.invoice_id,
    action: input.action,
    details: input.details || "",
    created_at: input.created_at,
    previous_hash: input.previous_hash || "",
  });
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function calculateAuditEventHash(input: AuditHashInput): Promise<string> {
  const bytes = new TextEncoder().encode(stableAuditPayload(input));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

export async function verifyAuditHashChain(
  events: Array<AuditHashInput & { event_hash?: string | null }>
) {
  let previousHash = "";
  for (const event of events) {
    if ((event.previous_hash || "") !== previousHash) {
      return { valid: false, failedEventId: event.invoice_id, reason: "previous_hash_mismatch" };
    }
    const expectedHash = await calculateAuditEventHash({ ...event, previous_hash: previousHash });
    if (event.event_hash !== expectedHash) {
      return { valid: false, failedEventId: event.invoice_id, reason: "event_hash_mismatch" };
    }
    previousHash = expectedHash;
  }
  return { valid: true, failedEventId: null, reason: null };
}

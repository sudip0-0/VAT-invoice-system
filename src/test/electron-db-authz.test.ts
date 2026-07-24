/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbModule = require("../../electron/db/index.cjs") as typeof import("../../electron/db/index.cjs");

describe("electron db authz + documents", () => {
  let dbFile = "";

  beforeEach(async () => {
    dbFile = path.join(os.tmpdir(), `vat-test-${Date.now()}-${Math.random()}.sqlite`);
    await dbModule.initializeDatabaseForTests(dbFile);
  });

  afterEach(() => {
    try {
      if (dbFile && fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
      if (dbFile && fs.existsSync(`${dbFile}.sha256`)) fs.unlinkSync(`${dbFile}.sha256`);
    } catch {
      // ignore
    }
  });

  it("rejects unauthenticated queries", async () => {
    const response = await dbModule.query({
      table: "parties",
      action: "select",
      filters: [],
    });
    expect(response.error?.message).toMatch(/Unauthorized/i);
  });

  it("scopes data by business membership", async () => {
    const signUpA = dbModule.auth.signUp({
      email: "owner-a@example.com",
      password: "password123",
      options: { data: { name: "A" } },
    });
    expect(signUpA.error).toBeNull();
    const userA = signUpA.data!.user.id;

    const bizA = crypto.randomUUID();
    await dbModule.query({
      table: "businesses",
      action: "insert",
      filters: [],
      payload: { id: bizA, name: "Biz A", address: "x", city: "y", phone: "1" },
    });
    await dbModule.query({
      table: "business_users",
      action: "insert",
      filters: [],
      payload: { business_id: bizA, user_id: userA, role: "owner" },
    });
    await dbModule.query({
      table: "parties",
      action: "insert",
      filters: [],
      payload: { business_id: bizA, name: "Customer A", type: "customer" },
    });

    await dbModule.auth.signOut();
    const signUpB = dbModule.auth.signUp({
      email: "owner-b@example.com",
      password: "password123",
      options: { data: { name: "B" } },
    });
    expect(signUpB.error).toBeNull();

    const leaked = await dbModule.query({
      table: "parties",
      action: "select",
      filters: [],
    });
    expect(leaked.error).toBeNull();
    expect(leaked.data).toEqual([]);
  });

  it("verifies malformed password hashes safely", () => {
    expect(dbModule.__test.verifyPassword("x", "not-a-hash")).toBe(false);
    expect(dbModule.__test.verifyPassword("x", "abc:zz")).toBe(false);
  });

  it("allows only http(s) external URLs", () => {
    expect(dbModule.__test.isAllowedExternalUrl("https://example.com")).toBe(true);
    expect(dbModule.__test.isAllowedExternalUrl("http://example.com")).toBe(true);
    expect(dbModule.__test.isAllowedExternalUrl("file:///etc/passwd")).toBe(false);
    expect(dbModule.__test.isAllowedExternalUrl("javascript:alert(1)")).toBe(false);
  });

  it("creates documents atomically with payment", async () => {
    const signUp = dbModule.auth.signUp({
      email: "docs@example.com",
      password: "password123",
      options: { data: { name: "Docs" } },
    });
    const userId = signUp.data!.user.id;
    const bizId = crypto.randomUUID();
    await dbModule.query({
      table: "businesses",
      action: "insert",
      filters: [],
      payload: { id: bizId, name: "Docs Biz", address: "a", city: "b", phone: "1" },
    });
    await dbModule.query({
      table: "business_users",
      action: "insert",
      filters: [],
      payload: { business_id: bizId, user_id: userId, role: "owner" },
    });

    const created = dbModule.documents.createAndIssue({
      invoice: {
        business_id: bizId,
        type: "sale",
        status: "issued",
        fiscal_year: "2082/83",
        issued_date_ad: "2026-07-24",
        issued_date_bs: "2083-04-09",
        is_vat_invoice: false,
        sub_total: 100,
        discount_amount: 0,
        taxable_amount: 100,
        vat_amount: 0,
        total_amount: 100,
        paid_amount: 100,
        balance_due: 0,
      },
      items: [
        {
          name: "Widget",
          quantity: 1,
          rate: 100,
          tax_type: "non_taxable",
          vat_rate: 0,
          taxable_amount: 100,
          vat_amount: 0,
          total_amount: 100,
        },
      ],
      paymentAmount: 100,
    });

    expect(created.error).toBeNull();
    expect(created.data?.id).toBeTruthy();

    const payments = await dbModule.query({
      table: "payments",
      action: "select",
      filters: [{ type: "eq", column: "business_id", value: bizId }],
    });
    expect(payments.data).toHaveLength(1);
  });

  it("adjusts stock atomically", async () => {
    const signUp = dbModule.auth.signUp({
      email: "stock@example.com",
      password: "password123",
      options: { data: { name: "Stock" } },
    });
    const userId = signUp.data!.user.id;
    const bizId = crypto.randomUUID();
    await dbModule.query({
      table: "businesses",
      action: "insert",
      filters: [],
      payload: { id: bizId, name: "Stock Biz", address: "a", city: "b", phone: "1" },
    });
    await dbModule.query({
      table: "business_users",
      action: "insert",
      filters: [],
      payload: { business_id: bizId, user_id: userId, role: "owner" },
    });
    const itemId = crypto.randomUUID();
    await dbModule.query({
      table: "items",
      action: "insert",
      filters: [],
      payload: {
        id: itemId,
        business_id: bizId,
        name: "Rice",
        type: "product",
        sale_price: 10,
        opening_stock: 5,
        current_stock: 5,
      },
    });

    const adjusted = dbModule.stock.adjust({
      business_id: bizId,
      item_id: itemId,
      quantity: 2,
      direction: "out",
      reason: "manual: test",
    });
    expect(adjusted.error).toBeNull();
    expect(adjusted.data?.stock_after).toBe(3);

    const movements = await dbModule.query({
      table: "stock_movements",
      action: "select",
      filters: [{ type: "eq", column: "item_id", value: itemId }],
    });
    expect(movements.data).toHaveLength(1);
  });

  it("encrypts and decrypts backup payload with passphrase", () => {
    const plain = Buffer.from("sqlite-bytes");
    const encrypted = dbModule.__test.encryptBackupBuffer(plain, "passphrase123");
    expect(encrypted.subarray(0, 6).toString()).toBe("VYENC1");
    const decrypted = dbModule.__test.decryptBackupBuffer(encrypted, "passphrase123");
    expect(decrypted.equals(plain)).toBe(true);
    expect(() => dbModule.__test.decryptBackupBuffer(encrypted, "wrong-pass")).toThrow(/passphrase|corrupted/i);
  });

  it("creates a member without switching the current session", async () => {
    const owner = dbModule.auth.signUp({
      email: "owner-team@example.com",
      password: "password123",
      options: { data: { name: "Owner" } },
    });
    expect(owner.error).toBeNull();
    const businessId = crypto.randomUUID();
    await dbModule.query({
      table: "businesses",
      action: "insert",
      filters: [],
      payload: { id: businessId, name: "Team Biz", type: "retail" },
    });
    await dbModule.query({
      table: "business_users",
      action: "insert",
      filters: [],
      payload: { business_id: businessId, user_id: owner.data!.user.id, role: "owner" },
    });

    const created = dbModule.auth.createMember({
      businessId,
      email: "staff-team@example.com",
      password: "password123",
      name: "Staff",
      role: "staff",
    });
    expect(created.error).toBeNull();
    expect(created.data?.createdUser).toBe(true);

    const session = dbModule.auth.getSession();
    expect(session.data?.session?.user.email).toBe("owner-team@example.com");

    const listed = dbModule.auth.listMembers({ businessId });
    expect(listed.error).toBeNull();
    expect(listed.data?.members.some((m: { email: string }) => m.email === "staff-team@example.com")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { signInSchema, signUpSchema, updatePasswordSchema } from "@/lib/schemas/auth";

describe("auth schemas", () => {
  it("accepts valid sign-in", () => {
    expect(signInSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });

  it("requires 8+ char password on sign-up", () => {
    expect(
      signUpSchema.safeParse({ email: "a@b.com", password: "short", name: "A" }).success
    ).toBe(false);
    expect(
      signUpSchema.safeParse({ email: "a@b.com", password: "longenough", name: "A" }).success
    ).toBe(true);
  });

  it("requires current password to update", () => {
    expect(
      updatePasswordSchema.safeParse({ currentPassword: "", password: "longenough" }).success
    ).toBe(false);
    expect(
      updatePasswordSchema.safeParse({ currentPassword: "oldpass12", password: "longenough" }).success
    ).toBe(true);
  });
});

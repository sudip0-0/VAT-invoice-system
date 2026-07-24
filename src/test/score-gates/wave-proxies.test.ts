import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../../..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("score-gate technical proxies", () => {
  it("documents membership-scoped auth (not fine-grained RBAC) in README", () => {
    const readme = read("README.md");
    expect(readme).not.toMatch(/role-based access/i);
    expect(readme).toMatch(/membership/i);
  });

  it("SCORECARD and gate commands exist", () => {
    expect(fs.existsSync(path.join(root, "SCORECARD.md"))).toBe(true);
    const agents = read("AGENTS.md");
    expect(agents).toMatch(/SCORECARD/);
    expect(agents).toMatch(/npm test/);
  });

  it("electron main hardens sandbox, CSP, and openExternal", () => {
    const main = read("electron/main.cjs");
    expect(main).toContain("contextIsolation: true");
    expect(main).toContain("nodeIntegration: false");
    expect(main).toContain("sandbox: true");
    expect(main).toContain("Content-Security-Policy");
    expect(main).toContain("isAllowedExternalUrl");
    expect(main).toContain("desktop:documents:create-and-issue");
    expect(main).toContain("desktop:stock:adjust");
  });

  it("auth schemas and document IPC surface exist", () => {
    expect(fs.existsSync(path.join(root, "src/lib/schemas/auth.ts"))).toBe(true);
    expect(fs.existsSync(path.join(root, "electron/logger.cjs"))).toBe(true);
    expect(fs.existsSync(path.join(root, "electron/db/migrations/runner.cjs"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src/components/documents/DocumentEditor.tsx"))).toBe(true);
    const preload = read("electron/preload.cjs");
    expect(preload).toContain("createAndIssue");
    expect(preload).toContain("openLogs");
  });
});

import { describe, expect, it } from "vitest";
import { getShortcutAction, isEditableTarget } from "@/hooks/useAppShortcuts";

describe("getShortcutAction", () => {
  it("matches new sale for Ctrl+Shift+S", () => {
    expect(
      getShortcutAction({
        key: "s",
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
        altKey: false,
      })
    ).toBe("newSale");
  });

  it("matches new purchase for Cmd+Shift+P", () => {
    expect(
      getShortcutAction({
        key: "P",
        ctrlKey: false,
        metaKey: true,
        shiftKey: true,
        altKey: false,
      })
    ).toBe("newPurchase");
  });

  it("matches recent invoice for Ctrl+Shift+R", () => {
    expect(
      getShortcutAction({
        key: "r",
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
        altKey: false,
      })
    ).toBe("recentInvoice");
  });

  it("does not match without shift modifier", () => {
    expect(
      getShortcutAction({
        key: "s",
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      })
    ).toBeNull();
  });

  it("does not match when alt key is pressed", () => {
    expect(
      getShortcutAction({
        key: "s",
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
        altKey: true,
      })
    ).toBeNull();
  });
});

describe("isEditableTarget", () => {
  it("returns true for input, textarea and select elements", () => {
    expect(isEditableTarget(document.createElement("input"))).toBe(true);
    expect(isEditableTarget(document.createElement("textarea"))).toBe(true);
    expect(isEditableTarget(document.createElement("select"))).toBe(true);
  });

  it("returns true for contenteditable descendants", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const child = document.createElement("span");
    editable.appendChild(child);

    expect(isEditableTarget(child)).toBe(true);
  });

  it("returns false for non-editable targets", () => {
    expect(isEditableTarget(document.createElement("button"))).toBe(false);
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { getVATReturnDeadline } from "@/lib/bs-calendar";

describe("getVATReturnDeadline", () => {
  it("returns the 25th day of the next BS month", () => {
    expect(getVATReturnDeadline("2081/04")).toBe("2081-05-25");
  });

  it("rolls Chaitra deadlines into the next BS year", () => {
    expect(getVATReturnDeadline("2081/12")).toBe("2082-01-25");
  });

  it("returns an empty string for unknown periods", () => {
    expect(getVATReturnDeadline("Unknown")).toBe("");
  });
});

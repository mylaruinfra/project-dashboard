import { describe, expect, it } from "vitest";
import { formatDate, isValidIsoDate, parseLooseDate } from "@/lib/dates";
import { gstinChecksumChar, isValidGstin } from "@/lib/gstin";
import { resolveDatabaseUrl } from "@/server/db/client";

describe("dates", () => {
  it("formats as DD MMM YYYY", () => {
    expect(formatDate("2026-10-05")).toBe("05 Oct 2026");
    expect(formatDate("2027-03-31")).toBe("31 Mar 2027");
    expect(formatDate(null)).toBe("—");
  });
  it("validates ISO dates strictly", () => {
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("05/10/2026")).toBe(false);
  });
  it("parses bill dates day-first", () => {
    expect(parseLooseDate("05/10/2026")).toBe("2026-10-05");
    expect(parseLooseDate("5-10-26")).toBe("2026-10-05");
    expect(parseLooseDate("05 Oct 2026")).toBe("2026-10-05");
    expect(parseLooseDate("5 October, 2026")).toBe("2026-10-05");
    expect(parseLooseDate("31/02/2026")).toBeNull();
    expect(parseLooseDate("garbage")).toBeNull();
  });
});

describe("gstin", () => {
  const base = "36AABCU9603R1Z";
  const valid = base + gstinChecksumChar(base);
  it("accepts a GSTIN with the right check digit", () => {
    expect(isValidGstin(valid)).toBe(true);
    expect(isValidGstin(valid.toLowerCase())).toBe(true);
  });
  it("rejects bad format, state code or check digit", () => {
    const wrong = base + (valid.endsWith("A") ? "B" : "A");
    expect(isValidGstin(wrong)).toBe(false);
    expect(isValidGstin("36AABCU9603R1Y5")).toBe(false);
    expect(isValidGstin("99AABCU9603R1ZM")).toBe(false);
    expect(isValidGstin("")).toBe(false);
  });
});

describe("test database guard", () => {
  it("uses TEST_DATABASE_URL under Vitest and refuses unsafe targets", () => {
    expect(resolveDatabaseUrl({ VITEST: "true", TEST_DATABASE_URL: "postgres://x@h/sitebook_test", DATABASE_URL: "postgres://x@h/sitebook" })).toContain("sitebook_test");
    expect(() => resolveDatabaseUrl({ VITEST: "true", DATABASE_URL: "postgres://x@h/sitebook" })).toThrow(/TEST_DATABASE_URL/);
    expect(() => resolveDatabaseUrl({ VITEST: "true", TEST_DATABASE_URL: "postgres://x@h/sitebook", DATABASE_URL: "postgres://x@h/other" })).toThrow(/test/);
    expect(() => resolveDatabaseUrl({ VITEST: "true", TEST_DATABASE_URL: "postgres://x@h/a_test", DATABASE_URL: "postgres://x@h/a_test" })).toThrow(/differ/);
  });
});

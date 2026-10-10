import { describe, expect, it } from "vitest";
import { z } from "zod";
import { can, canSeeMoney } from "@/lib/access";
import { AppError, toAppError } from "@/server/errors";

describe("error envelope mapping", () => {
  it("keeps AppErrors and maps zod errors to field messages", () => {
    const e = toAppError(new AppError("FORBIDDEN", "No"));
    expect([e.code, e.status]).toEqual(["FORBIDDEN", 403]);
    const r = z.object({ name: z.string().min(1, "Name is required") }).safeParse({ name: "" });
    const v = toAppError(r.error);
    expect(v.code).toBe("VALIDATION");
    expect(v.fields).toEqual({ name: "Name is required" });
  });

  it("maps Postgres unique and check violations (also when wrapped)", () => {
    expect(toAppError({ code: "23505", constraint: "transactions_vendor_bill_uq" })).toMatchObject({ code: "CONFLICT", status: 409, fields: { billNo: expect.any(String) } });
    expect(toAppError({ message: "wrapped", cause: { code: "23514", constraint: "project_stock_non_negative_ck" } })).toMatchObject({ code: "BUSINESS_RULE", message: "Stock cannot go below zero." });
  });

  it("hides unknown errors behind a generic message", () => {
    const e = toAppError(new Error("connection string with password"));
    expect(e.code).toBe("INTERNAL");
    expect(e.message).not.toContain("password");
  });
});

describe("permission matrix", () => {
  it("matches the brief", () => {
    expect(can({ role: "ADMIN" }, "user.manage")).toBe(true);
    expect(can({ role: "MANAGER" }, "user.manage")).toBe(false);
    expect(can({ role: "MANAGER" }, "settings.manage")).toBe(true);
    expect(can({ role: "ENGINEER" }, "field.write")).toBe(true);
    expect(can({ role: "ENGINEER" }, "finance.write")).toBe(false);
    expect(canSeeMoney({ role: "ENGINEER" })).toBe(false);
    expect(canSeeMoney({ role: "VIEWER" })).toBe(true);
    expect(["project.write", "finance.write", "field.write", "master.write", "record.void"].some((p) => can({ role: "VIEWER" }, p as never))).toBe(false);
    expect(can({ role: "MANAGER" }, "draft.delete")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { isValidNotifyPhone } from "@/lib/notifyPhone";

describe("isValidNotifyPhone", () => {
  it("allows empty optional values", () => {
    expect(isValidNotifyPhone("")).toBe(true);
    expect(isValidNotifyPhone("   ")).toBe(true);
  });

  it("accepts Sri Lanka local and E.164 forms", () => {
    expect(isValidNotifyPhone("0771234567")).toBe(true);
    expect(isValidNotifyPhone("+94771234567")).toBe(true);
    expect(isValidNotifyPhone("94771234567")).toBe(true);
  });

  it("rejects garbage", () => {
    expect(isValidNotifyPhone("abc")).toBe(false);
    expect(isValidNotifyPhone("123")).toBe(false);
    expect(isValidNotifyPhone("+12")).toBe(false);
  });
});

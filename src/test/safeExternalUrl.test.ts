import { describe, expect, it } from "vitest";
import { safeExternalUrl } from "@/lib/safeExternalUrl";

describe("safeExternalUrl", () => {
  it("allows http and https URLs", () => {
    expect(safeExternalUrl("https://ikman.lk/en/ad/example")).toBe(
      "https://ikman.lk/en/ad/example",
    );
    expect(safeExternalUrl("http://example.com/path")).toBe("http://example.com/path");
  });

  it("normalizes protocol-relative URLs to https", () => {
    expect(safeExternalUrl("//cdn.example.com/a")).toBe("https://cdn.example.com/a");
  });

  it("blocks dangerous schemes", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("JAVASCRIPT:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeExternalUrl("vbscript:msgbox(1)")).toBeNull();
    expect(safeExternalUrl("file:///etc/passwd")).toBeNull();
  });

  it("rejects empty, non-string, relative, and malformed values", () => {
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
    expect(safeExternalUrl("")).toBeNull();
    expect(safeExternalUrl("   ")).toBeNull();
    expect(safeExternalUrl("/listing/11")).toBeNull();
    expect(safeExternalUrl("not a url")).toBeNull();
    expect(safeExternalUrl(42)).toBeNull();
  });

  it("trims surrounding whitespace before validating", () => {
    expect(safeExternalUrl("  https://example.com/ok  ")).toBe("https://example.com/ok");
  });
});

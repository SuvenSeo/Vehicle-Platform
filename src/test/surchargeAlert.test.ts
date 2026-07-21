import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SURCHARGE_EXPIRY_ISO } from "@/lib/importTaxModel";
import {
  consumeSurchargeLapseNotification,
  isSurchargeNotifySubscribed,
  subscribeSurchargeLapseNotify,
  unsubscribeSurchargeLapseNotify,
} from "@/lib/surchargeAlert";

describe("surchargeAlert", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("subscribes and unsubscribes via localStorage", () => {
    expect(isSurchargeNotifySubscribed()).toBe(false);
    subscribeSurchargeLapseNotify();
    expect(isSurchargeNotifySubscribed()).toBe(true);
    unsubscribeSurchargeLapseNotify();
    expect(isSurchargeNotifySubscribed()).toBe(false);
  });

  it("does not notify before gazetted expiry", () => {
    subscribeSurchargeLapseNotify(new Date("2026-06-01T00:00:00+05:30"));
    expect(consumeSurchargeLapseNotification(new Date("2026-07-01T00:00:00+05:30"))).toBeNull();
    expect(isSurchargeNotifySubscribed()).toBe(true);
  });

  it("fires a one-shot notification after expiry", () => {
    subscribeSurchargeLapseNotify(new Date("2026-06-01T00:00:00+05:30"));
    const after = new Date(`${SURCHARGE_EXPIRY_ISO}T12:00:00+05:30`);
    after.setDate(after.getDate() + 1);
    const message = consumeSurchargeLapseNotification(after);
    expect(message).toMatch(/CID surcharge/i);
    expect(consumeSurchargeLapseNotification(after)).toBeNull();
  });
});

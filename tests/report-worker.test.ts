import { describe, expect, it } from "vitest";
import { deliverReportBatch, FakeMailProvider, type ClaimedDelivery, type DeliveryStore } from "../src/server/report-delivery";
const delivery: ClaimedDelivery = {
  id: "10000000-0000-0000-0000-000000000001", report_id: "20000000-0000-0000-0000-000000000001",
  recipient_email: "jefe@example.test", lease_token: "30000000-0000-0000-0000-000000000001",
};
function storeFixture() {
  const completed: string[] = [];
  const failures: string[] = [];
  let claims = 0;
  const store: DeliveryStore = {
    async claim() { claims++; return [{ ...delivery }]; },
    async complete(_delivery, id) { completed.push(id); },
    async fail(_delivery, code) { failures.push(code); },
  };
  return { store, completed, failures, claims: () => claims };
}
describe("consumidor de reportes sin correo real", () => {
  it("aceptación ambigua y reintento conservan una sola entrega externa", async () => {
    const f = storeFixture();
    const provider = new FakeMailProvider();
    provider.failures.push("accepted_timeout");
    expect(await deliverReportBatch(f.store, provider, "https://example.test")).toBe(0);
    expect(f.failures).toEqual(["acceptance_unknown"]);
    expect(await deliverReportBatch(f.store, provider, "https://example.test")).toBe(1);
    expect(provider.accepted.size).toBe(1);
    expect(f.completed).toEqual([`fake:${delivery.id}`]);
    const notice = provider.accepted.get(delivery.id)!.notice;
    expect(notice.text).toContain(`/reportes/${delivery.report_id}`);
    expect(notice.text).not.toContain("peso");
  });
  it("un ACK fallido deja lease para recuperación sin mandar un segundo correo", async () => {
    const f = storeFixture(); const provider = new FakeMailProvider();
    f.store.complete = async () => { throw new Error("database timeout"); };
    await expect(deliverReportBatch(f.store, provider, "https://example.test")).rejects.toThrow("database timeout");
    expect(f.failures).toEqual([]);
    f.store.complete = async (_d, id) => { f.completed.push(id); };
    await deliverReportBatch(f.store, provider, "https://example.test");
    expect(provider.accepted.size).toBe(1);
  });
  it("rechaza proveedor sin deduplicación y origen inseguro antes de reclamar", async () => {
    const f = storeFixture(); const provider = new FakeMailProvider();
    provider.supportsStableIdempotency = false;
    await expect(deliverReportBatch(f.store, provider, "https://example.test")).rejects.toThrow("deduplicación");
    await expect(deliverReportBatch(f.store, provider, "http://example.test")).rejects.toThrow("HTTPS");
    expect(f.claims()).toBe(0);
  });
});

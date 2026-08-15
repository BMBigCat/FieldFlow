import { buildLaborLineItem, calculateInvoiceTotal, NullAdapter } from "../index";

describe("buildLaborLineItem", () => {
  test("sums closed clock sessions into a single Labor line item priced at the given rate", () => {
    const item = buildLaborLineItem(
      [
        { clockInAt: "2026-01-01T09:00:00.000Z", clockOutAt: "2026-01-01T11:00:00.000Z" }, // 2h
        { clockInAt: "2026-01-01T13:00:00.000Z", clockOutAt: "2026-01-01T13:30:00.000Z" }, // 0.5h
      ],
      100,
    );
    expect(item).toEqual({ description: "Labor", quantity: 2.5, unitPrice: 100, kind: "labor" });
  });

  test("excludes sessions still clocked in (no clockOutAt)", () => {
    const item = buildLaborLineItem(
      [
        { clockInAt: "2026-01-01T09:00:00.000Z", clockOutAt: "2026-01-01T10:00:00.000Z" }, // 1h
        { clockInAt: "2026-01-01T11:00:00.000Z", clockOutAt: null }, // still open — excluded
      ],
      50,
    );
    expect(item?.quantity).toBe(1);
  });

  test("returns null when there's nothing closed to bill for labor", () => {
    expect(buildLaborLineItem([{ clockInAt: "2026-01-01T09:00:00.000Z", clockOutAt: null }], 100)).toBeNull();
    expect(buildLaborLineItem([], 100)).toBeNull();
  });

  test("prices at $0 rather than throwing when the org hasn't set a labor rate", () => {
    const item = buildLaborLineItem(
      [{ clockInAt: "2026-01-01T09:00:00.000Z", clockOutAt: "2026-01-01T10:00:00.000Z" }],
      null,
    );
    expect(item?.unitPrice).toBe(0);
  });
});

describe("calculateInvoiceTotal", () => {
  test("sums quantity * unitPrice across line items plus a flat tax amount", () => {
    const total = calculateInvoiceTotal(
      [
        { quantity: 2, unitPrice: 100 }, // 200
        { quantity: 1, unitPrice: 49.99 },
      ],
      12.5,
    );
    expect(total).toBe(262.49);
  });

  test("rounds to the cent", () => {
    const total = calculateInvoiceTotal([{ quantity: 3, unitPrice: 0.1 }], 0);
    expect(total).toBe(0.3);
  });

  test("zero line items plus zero tax is zero", () => {
    expect(calculateInvoiceTotal([], 0)).toBe(0);
  });
});

describe("NullAdapter", () => {
  test("push and pullPaymentStatus both no-op, per build plan §5 Phase 5 default", async () => {
    const adapter = new NullAdapter();
    await expect(adapter.push({ id: "inv-1", total: 100 })).resolves.toBeNull();
    await expect(adapter.pullPaymentStatus("ext-ref")).resolves.toBeNull();
  });
});

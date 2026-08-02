import { describe, expect, it } from "vitest";

import { CanonicalSerializer } from "../src/CanonicalSerializer.js";

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe("CanonicalSerializer", () => {
  it("produces identical output for equivalent objects regardless of key order", () => {
    const serializer = new CanonicalSerializer();

    const first = serializer.serialize({ a: 1, b: 2, c: 3 });
    const second = serializer.serialize({ c: 3, a: 1, b: 2 });

    expect(decode(first)).toBe(decode(second));
  });

  it("produces identical output for equivalent nested objects regardless of key order", () => {
    const serializer = new CanonicalSerializer();

    const first = serializer.serialize({
      outer: { z: "last", a: "first" },
      id: "txn-1",
    });
    const second = serializer.serialize({
      id: "txn-1",
      outer: { a: "first", z: "last" },
    });

    expect(decode(first)).toBe(decode(second));
  });

  it("produces different output for genuinely different input", () => {
    const serializer = new CanonicalSerializer();

    const first = serializer.serialize({ amount: 100 });
    const second = serializer.serialize({ amount: 200 });

    expect(decode(first)).not.toBe(decode(second));
  });

  it("distinguishes a missing key from an equal-looking value elsewhere", () => {
    const serializer = new CanonicalSerializer();

    const first = serializer.serialize({ a: 1 });
    const second = serializer.serialize({ b: 1 });

    expect(decode(first)).not.toBe(decode(second));
  });

  it("emits canonical (key-sorted) JSON text as its output format", () => {
    const serializer = new CanonicalSerializer();

    const bytes = serializer.serialize({ b: 2, a: 1 });

    expect(decode(bytes)).toBe('{"a":1,"b":2}');
  });

  it("preserves array element order (only object keys are sorted)", () => {
    const serializer = new CanonicalSerializer();

    const bytes = serializer.serialize({ list: [3, 1, 2] });

    expect(decode(bytes)).toBe('{"list":[3,1,2]}');
  });

  it("normalizes Date values to an ISO string", () => {
    const serializer = new CanonicalSerializer();

    const date = new Date("2026-01-01T00:00:00.000Z");
    const bytes = serializer.serialize({ createdAt: date });

    expect(decode(bytes)).toBe('{"createdAt":"2026-01-01T00:00:00.000Z"}');
  });

  it("round-trips through JSON.parse back to the same logical value", () => {
    const serializer = new CanonicalSerializer();

    const value = { b: [1, 2, 3], a: { nested: true } };
    const bytes = serializer.serialize(value);

    expect(JSON.parse(decode(bytes))).toEqual({
      a: { nested: true },
      b: [1, 2, 3],
    });
  });

  it("handles empty input sensibly: empty object, empty array, null", () => {
    const serializer = new CanonicalSerializer();

    expect(decode(serializer.serialize({}))).toBe("{}");
    expect(decode(serializer.serialize([]))).toBe("[]");
    expect(decode(serializer.serialize(null))).toBe("null");
  });
});

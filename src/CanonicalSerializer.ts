/**
 * Canonical Serializer.
 *
 * Produces a deterministic byte representation of an
 * immutable object.
 *
 * Cryptographic operations (hashing, signing,
 * verification) must operate on canonical serialized
 * bytes produced by this class so they all see
 * identical data for the same logical object.
 */
export class CanonicalSerializer {
  /**
   * Serializes an object into canonical UTF-8 bytes.
   *
   * Objects are recursively normalized by sorting keys
   * lexicographically.
   */
  serialize(value: unknown): Uint8Array {
    const canonical = JSON.stringify(this.normalize(value));

    return new TextEncoder().encode(canonical);
  }

  /**
   * Recursively normalizes values.
   */
  private normalize(value: unknown): unknown {
    //
    // null
    //
    if (value === null) {
      return null;
    }

    //
    // primitives
    //
    if (typeof value !== "object") {
      return value;
    }

    //
    // arrays preserve order
    //
    if (Array.isArray(value)) {
      return value.map((item) => this.normalize(item));
    }

    //
    // Date
    //
    if (value instanceof Date) {
      return value.toISOString();
    }

    //
    // objects
    //
    const object = value as Record<string, unknown>;

    return Object.keys(object)
      .sort()
      .reduce<Record<string, unknown>>((normalized, key) => {
        // Object.keys() on a JSON.parse()'d object can legitimately
        // include a literal "__proto__" key. Plain bracket assignment
        // (normalized[key] = ...) would divert that specific key into
        // the prototype setter instead of creating a normal own
        // property, silently dropping it from the canonical output.
        // Object.defineProperty always creates/updates a real own
        // data property regardless of the key's name.
        Object.defineProperty(normalized, key, {
          value: this.normalize(object[key]),
          enumerable: true,
          writable: true,
          configurable: true,
        });

        return normalized;
      }, {});
  }
}

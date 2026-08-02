/**
 * Base error for all cryptographic operations.
 *
 * All errors raised by this library extend this class.
 */
export class CryptoError extends Error {
  /**
   * Creates a new CryptoError.
   *
   * @param message Error message.
   */
  constructor(message: string) {
    super(message);

    this.name = "CryptoError";

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

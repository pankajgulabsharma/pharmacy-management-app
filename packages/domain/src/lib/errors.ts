/**
 * A shop rule was broken ("GSTIN already used", "Name is required"…).
 * The message is shown to the user as-is; the server answers 400 with it.
 */
export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleError";
  }
}

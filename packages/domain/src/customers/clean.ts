/**
 * Normalise and check a customer account before it is saved — app AND server.
 */
import { RuleError } from "../lib/errors";
import { cleanText } from "../lib/sanitize";
import { CUSTOMER_LIMITS as L, type Customer, type CustomerInput } from "./types";
import { digits, isValidPhone } from "./validation";

/** `others` = every OTHER customer (for the one-account-per-mobile rule) */
export function cleanCustomerInput(input: CustomerInput, others: readonly Pick<Customer, "phone">[]): CustomerInput {
  const name = cleanText(input.name, L.nameMax);
  if (name.length < 2) throw new RuleError("Name is required");
  if (!isValidPhone(input.phone)) throw new RuleError("Enter a 10-digit mobile number");
  const phone = digits(input.phone);
  if (phone && others.some((c) => c.phone === phone)) throw new RuleError("Another customer has this number");
  const limit = Number.isInteger(input.creditLimitPaise) ? input.creditLimitPaise : 0;
  return {
    name,
    phone,
    address: cleanText(input.address, L.addressMax),
    creditLimitPaise: Math.max(0, Math.min(L.maxCreditLimitPaise, limit)),
    notes: cleanText(input.notes, L.notesMax),
    status: input.status === "inactive" ? "inactive" : "active",
  };
}

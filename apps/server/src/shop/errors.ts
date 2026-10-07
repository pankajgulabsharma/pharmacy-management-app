import { SaleError } from "@medicare/domain/billing/sale";
import { SaleReturnError } from "@medicare/domain/billing/saleReturn";
import { StockError } from "@medicare/domain/inventory/ledger";
import { RuleError } from "@medicare/domain/lib/errors";
import { ReturnError } from "@medicare/domain/purchases/returns";

/** The thing asked for doesn't exist → 404 */
export class NotFoundError extends Error {}

/** A shop rule said no ("out of stock", "over udhaar limit"…) → 400 with its message */
export function isRuleError(err: unknown): err is Error {
  return [RuleError, SaleError, SaleReturnError, StockError, ReturnError].some(
    (E) => err instanceof E,
  );
}

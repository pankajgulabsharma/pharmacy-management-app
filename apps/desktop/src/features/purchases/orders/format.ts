import { formatPaise } from "@medicare/domain/lib/money";

/** "₹1,234.50" for a rate in paise (0 = unknown) */
export const rateText = (p: number) => (p ? `₹${formatPaise(p)}` : "—");

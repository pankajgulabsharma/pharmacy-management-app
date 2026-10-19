/**
 * What a shop has bought. MediCare is sold one-time + yearly AMC, in two
 * plans:
 *
 *   single  one billing computer
 *   multi   several counters on the shop network + staff commission
 *
 * The plan comes from the licence key (or from how many computers it
 * allows). A trial is the Single computer plan (one counter);
 * development copies show everything.
 */
export type Plan = "single" | "multi";
export type Feature = "staffCommission";

export const PLAN_LABEL: Record<Plan, string> = {
  single: "Single computer",
  multi: "Multi-counter",
};

/** What each plan includes beyond the basics (billing, stock, GST, …) */
export const PLAN_FEATURES: Record<Plan, readonly Feature[]> = {
  single: [],
  multi: ["staffCommission"],
};

export const FEATURE_LABEL: Record<Feature, string> = {
  staffCommission: "Staff commission",
};

export function planOf(
  status: string,
  counters: number | null,
  explicit?: Plan,
): Plan {
  if (status === "off") return "multi";
  if (status === "trial") return "single";
  if (explicit === "single" || explicit === "multi") return explicit;
  return (counters ?? 1) > 1 ? "multi" : "single";
}

export const hasFeature = (plan: Plan, f: Feature) =>
  PLAN_FEATURES[plan].includes(f);

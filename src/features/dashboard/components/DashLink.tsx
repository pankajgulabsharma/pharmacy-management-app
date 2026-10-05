import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

/** "View all →" link used in the corner of dashboard widgets */
export function ViewAll({
  to,
  children = "View all",
}: {
  to: string;
  children?: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-background px-2.5 py-1 text-[10px] font-medium text-primary hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {children}
      <ChevronRight className="h-3 w-3" />
    </Link>
  );
}

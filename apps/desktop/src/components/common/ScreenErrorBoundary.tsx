import { Component, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tr } from "@/lib/i18n";

/**
 * If one screen breaks, only that screen shows a message — the rest of
 * the app (and any bill on the Billing tab) keeps working.
 */
export class ScreenErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: unknown) {
    console.error("Screen error:", err);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <TriangleAlert className="mx-auto h-8 w-8 text-amber-500" />
          <p className="text-sm font-semibold">
            {tr("This screen ran into a problem")}
          </p>
          <p className="text-[12px] text-muted-foreground">
            {tr(
              "Your data is safe on the server. Try opening the screen again.",
            )}
          </p>
          <Button
            type="button"
            onClick={() => this.setState({ failed: false })}
            className="h-9 rounded-lg text-[12px]"
          >
            {tr("Try again")}
          </Button>
        </div>
      </div>
    );
  }
}

import { Link, useLocation } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tr } from "@/lib/i18n";

/** Unknown address inside the app */
export default function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <div className="h-full w-full flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Compass className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-semibold">{tr("Page not found")}</h1>
        <p className="mt-1 text-[12px] text-muted-foreground break-all">
          {tr("There is no screen at")}{" "}
          <span className="font-mono">{pathname}</span>
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button
            nativeButton={false}
            render={<Link to="/dashboard" />}
            className="h-9 rounded-lg text-[12px]"
          >
            {tr("Go to Dashboard")}
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to="/billing" />}
            className="h-9 rounded-lg text-[12px]"
          >
            {tr("New bill")}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState, type ReactElement } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { PageActiveContext } from "@/hooks/usePageActive";
import { ScreenErrorBoundary } from "@/components/common/ScreenErrorBoundary";

/** URL instructions that only move the cursor — they never reset a screen */
const SOFT_PARAMS = new Set(["focus"]);

/** One kept screen; `nav` = the navigation that (re)opened it */
type Page = { path: string; el: ReactElement; nav: string };

/**
 * Like <Outlet/>, but screens you leave stay mounted (hidden), so switching
 * tabs never loses a half-made bill, a search, a filter or an open form.
 *
 * A link that carries instructions (e.g. Dashboard → /inventory?status=low,
 * or the header search → /customers?q=…) opens that screen fresh, because
 * that is what was asked for. Signing out clears everything.
 */
export function KeepAliveOutlet() {
  const outlet = useOutlet();
  const location = useLocation();
  const [pages, setPages] = useState<Page[]>([]);

  const current = pages.find((p) => p.path === location.pathname);
  const freshAsked = [...new URLSearchParams(location.search).keys()].some(
    (k) => !SOFT_PARAMS.has(k),
  );
  if (outlet && (!current || (freshAsked && current.nav !== location.key))) {
    // Updating state while rendering is React's pattern for "derive from props"
    const page = { path: location.pathname, el: outlet, nav: location.key };
    setPages((list) => [...list.filter((p) => p.path !== page.path), page]);
  }

  return (
    <>
      {pages.map(({ path, el, nav }) => {
        const active = path === location.pathname;
        return (
          <div key={`${path}#${nav}`} hidden={!active} className="h-full">
            <PageActiveContext.Provider value={active}>
              <ScreenErrorBoundary>{el}</ScreenErrorBoundary>
            </PageActiveContext.Provider>
          </div>
        );
      })}
    </>
  );
}

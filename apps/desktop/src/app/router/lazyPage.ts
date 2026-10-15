import { Suspense, createElement, lazy, type ComponentType } from "react";
import { Loader2 } from "lucide-react";

type Loader = () => Promise<{ default: ComponentType }>;

const loaders: Loader[] = [];

/** Light placeholder for the moment a screen's code arrives */
const Loading = () =>
  createElement(
    "div",
    { className: "h-full w-full flex items-center justify-center" },
    createElement(Loader2, {
      className: "h-5 w-5 animate-spin text-muted-foreground",
      "aria-label": "Loading",
    }),
  );

/**
 * A screen whose code is loaded on first use — the app opens faster
 * because the first download is only Login, Dashboard and Billing.
 * preloadPages() then fetches the rest in the background, so switching
 * screens never waits.
 */
export function lazyPage(load: Loader): ComponentType {
  loaders.push(load);
  const Page = lazy(load);
  return function LazyPage() {
    return createElement(
      Suspense,
      { fallback: createElement(Loading) },
      createElement(Page),
    );
  };
}

let preloaded = false;
/** After sign-in, when the app is idle: load every other screen's code */
export function preloadPages() {
  if (preloaded) return;
  preloaded = true;
  for (const load of loaders) void load().catch(() => {});
}

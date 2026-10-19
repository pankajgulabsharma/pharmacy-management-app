import { Suspense, createElement, lazy, type ComponentType } from "react";
import { AppLoader } from "@/components/common/AppLoader";

type Loader = () => Promise<{ default: ComponentType }>;

const loaders: Loader[] = [];

/** Light placeholder for the moment a screen's code arrives */
const Loading = () =>
  createElement(AppLoader, { size: "screen", message: "Loading…" });

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

import { createContext, useContext } from "react";

/**
 * Screens stay alive in the background when you switch tabs (your bill,
 * searches and open forms are kept). A background screen must not react
 * to keys or hold a dialog open — this says whether it is the visible one.
 * Anything outside a screen (header, sidebar) is always "active".
 */
export const PageActiveContext = createContext(true);

export const usePageActive = () => useContext(PageActiveContext);

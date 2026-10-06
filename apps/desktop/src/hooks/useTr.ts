import { useCallback } from "react";
import { useTranslation } from "react-i18next";

/**
 * Translate plain-English UI text in components. Re-renders when the
 * language changes. Unknown text is returned unchanged (stays English).
 *   const tr = useTr();  <h2>{tr("Low stock")}</h2>
 */
export function useTr() {
  const { t } = useTranslation("ui");
  return useCallback(
    <T>(text: T): T =>
      typeof text === "string" ? (t(text, { defaultValue: text }) as T) : text,
    [t],
  );
}

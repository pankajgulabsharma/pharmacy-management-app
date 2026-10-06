/** CSV building lives in @medicare/domain; downloading is browser-only and stays here */
export * from "@medicare/domain/lib/csv";

/** Saves text as a file in the browser (no server involved) */
export function downloadText(
  filename: string,
  text: string,
  type = "text/csv;charset=utf-8",
) {
  const safeName =
    filename.replace(/[^\w.-]+/g, "_").slice(0, 100) || "export.csv";
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CSV building lives in @medicare/domain; downloading is browser-only and stays here */
export * from "@medicare/domain/lib/csv";

/** Saves a file to the computer's Downloads (no server involved) */
export function saveBlob(blob: Blob, filename: string) {
  const safeName =
    filename.replace(/[^\w.-]+/g, "_").slice(0, 100) || "export.csv";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Saves text (CSV by default) as a file */
export const downloadText = (
  filename: string,
  text: string,
  type = "text/csv;charset=utf-8",
) => saveBlob(new Blob([text], { type }), filename);

import { desktopBridge, type PrintJob } from "./desktop";

/**
 * Prints a complete HTML page (a bill, labels…).
 *  • Installed app: straight to the chosen printer (no dialog), at the
 *    right paper size; with no printer chosen, the print dialog opens.
 *  • Browser: the page is printed from a hidden frame — the browser's
 *    print dialog shows ONLY that page (never the app screen behind).
 */
export async function printHtml(job: PrintJob): Promise<void> {
  const bridge = desktopBridge();
  if (bridge) {
    const r = await bridge.print(job);
    if (!r.ok && r.error && r.error !== "cancelled")
      throw new Error(`Printing failed: ${r.error}`);
    return;
  }
  await new Promise<void>((resolve) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    frame.srcdoc = job.html;
    frame.onload = () => {
      const w = frame.contentWindow!;
      const done = () => {
        frame.remove();
        resolve();
      };
      w.addEventListener("afterprint", done, { once: true });
      setTimeout(done, 60_000); // never leave a frame behind
      w.focus();
      w.print(); // copies are chosen in the browser's dialog
    };
    document.body.appendChild(frame);
  });
}

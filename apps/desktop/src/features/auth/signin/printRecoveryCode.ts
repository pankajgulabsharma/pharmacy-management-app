import { printHtml } from "@/lib/print";

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );

/** A small slip with the owner recovery code — keep it at home */
export function printRecoveryCode(code: string, shop: string) {
  const date = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return printHtml({
    html: `<!doctype html><html><head><meta charset="utf-8"><title>Recovery code</title>
<style>
  @page { size: A5; margin: 16mm; }
  body { font-family: system-ui, sans-serif; color: #0f172a; }
  .box { border: 2px dashed #6366f1; border-radius: 12px; padding: 24px; text-align: center; }
  .code { font: 600 30px/1.2 ui-monospace, monospace; letter-spacing: .25em; margin: 18px 0; }
  p { margin: 6px 0; font-size: 13px; color: #334155; }
  h1 { font-size: 18px; margin: 0 0 4px; }
</style></head><body><div class="box">
  <h1>MediCare Pharmacy — owner recovery code</h1>
  <p>${esc(shop)}</p>
  <div class="code">${esc(code)}</div>
  <p>Forgot the owner password? Sign-in screen → owner's name → <b>Forgot password?</b> → type this code.</p>
  <p>Works once. Keep this paper at home, not near the computer.</p>
  <p style="margin-top:14px;font-size:11px;color:#64748b">Made on ${esc(date)}</p>
</div></body></html>`,
  });
}

import JsBarcode from "jsbarcode";
import { isValidEan13 } from "@medicare/domain/printing/labels";

/**
 * Barcode drawing (SVG markup) for labels. EAN-13 when the code is one
 * (manufacturer / in-store codes), otherwise Code 128 (any text).
 */
export function barcodeSvg(code: string): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, code, {
    format: isValidEan13(code) ? "EAN13" : "CODE128",
    width: 2,
    height: 50,
    margin: 0,
    fontSize: 14,
    textMargin: 1,
    displayValue: true,
  });
  // Scale with the label (the label CSS sets the size)
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const w = svg.getAttribute("width");
  const h = svg.getAttribute("height");
  if (w && h)
    svg.setAttribute("viewBox", `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  return svg.outerHTML;
}

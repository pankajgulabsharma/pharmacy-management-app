import qrcode from "qrcode-generator";

/**
 * UPI payment link (NPCI format) — every UPI app (GPay, PhonePe, Paytm,
 * BHIM…) opens it with the shop and the exact amount filled in.
 */
export function upiLink(
  vpa: string,
  shopName: string,
  amountPaise: number,
  note: string,
) {
  const q = new URLSearchParams({
    pa: vpa,
    pn: shopName.slice(0, 40),
    am: (amountPaise / 100).toFixed(2),
    cu: "INR",
    tn: note.slice(0, 40),
  });
  return `upi://pay?${q.toString().replace(/\+/g, "%20")}`;
}

/** QR modules (true = dark) for any text — drawn as SVG by <QrCode> */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => qr.isDark(r, c)),
  );
}

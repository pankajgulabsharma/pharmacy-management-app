import { Fragment, type ReactNode } from "react";

/** *bold* and _italic_ as WhatsApp shows them */
function styled(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*[^*\n]+\*|_[^_\n]+_)/g;
  let last = 0;
  for (const m of line.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push(line.slice(last, i));
    const t = m[0];
    out.push(
      t.startsWith("*") ? (
        <b key={i}>{t.slice(1, -1)}</b>
      ) : (
        <i key={i}>{t.slice(1, -1)}</i>
      ),
    );
    last = i + t.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

/** The message as it will look in WhatsApp (green chat bubble) */
export function WhatsAppPreview({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-[#efeae2] p-3 dark:bg-[#0b141a]">
      <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[12px] leading-relaxed text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
        {text.split("\n").map((line, i) => (
          <Fragment key={i}>
            {i > 0 ? <br /> : null}
            {styled(line)}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

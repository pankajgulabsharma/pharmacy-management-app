/**
 * Focus an input and put the caret after its text — use after filling a
 * field programmatically (e.g. "Pay full"), so the user can keep typing.
 */
export function focusAtEnd(el: HTMLInputElement | null): void {
  if (!el) return;
  // Wait for React to commit the new value before moving the caret
  requestAnimationFrame(() => {
    el.focus();
    const end = el.value.length;
    try {
      el.setSelectionRange(end, end);
    } catch {
      // Some input types (date, number) don't support selection ranges
    }
  });
}

/** Opens the native picker of a date/time input (Chrome, Edge, Safari 16+, Firefox 101+) */
export function openNativePicker(el: HTMLInputElement): void {
  try {
    el.showPicker?.();
  } catch {
    // Throws if not triggered by a user gesture or inside a cross-origin iframe
  }
}

/**
 * Scrolls a table row fully into view inside its scrolling container,
 * keeping it BELOW a sticky <thead>. (scrollIntoView + scroll-margin is
 * unreliable on table rows across browsers, so we do the maths.)
 */
export function scrollRowIntoView(row: HTMLElement | null, gap = 4): void {
  if (!row) return;
  let box: HTMLElement | null = row.parentElement;
  while (
    box &&
    !(
      box.scrollHeight > box.clientHeight &&
      /(auto|scroll)/.test(getComputedStyle(box).overflowY)
    )
  ) {
    box = box.parentElement;
  }
  if (!box) return;
  const head = box.querySelector("thead");
  const c = box.getBoundingClientRect();
  const r = row.getBoundingClientRect();
  const visibleTop = c.top + (head ? head.getBoundingClientRect().height : 0);
  if (r.top < visibleTop) box.scrollTop -= visibleTop - r.top + gap;
  else if (r.bottom > c.bottom) box.scrollTop += r.bottom - c.bottom + gap;
}

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

/**
 * Open dialogs, innermost last. Only the topmost dialog reacts to keys,
 * and page-level shortcuts pause while any dialog is open.
 */
const stack: symbol[] = [];

export function pushModal(): symbol {
  const token = Symbol("modal");
  stack.push(token);
  return token;
}

export function popModal(token: symbol): void {
  const i = stack.indexOf(token);
  if (i >= 0) stack.splice(i, 1);
}

export function isTopModal(token: symbol): boolean {
  return stack[stack.length - 1] === token;
}

export function isAnyModalOpen(): boolean {
  return stack.length > 0;
}

/** "1 bill" / "3 bills" / "1 batch" / "2 batches" */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

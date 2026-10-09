/**
 * ONE search for the whole app (billing, medicines, stock, purchases,
 * suppliers, customers, bills, header search) — so every box behaves the
 * same way:
 *
 *  - every word typed must match, in any order ("650 para" = "para 650")
 *  - a word matches the START of a word in the item: "para" finds
 *    Paracetamol, "tab" finds Tablet, "650" finds 650mg — but "ol" or "5"
 *    no longer match the middle of unrelated words / barcodes
 *  - plurals are fine: "tablets" finds Tablet
 *  - codes (batch no., barcode, bill no., mobile, GSTIN) also match from
 *    the middle once 3+ characters are typed ("6106" finds PA6106J)
 *  - best first: name starts with what was typed → every word in the
 *    name → found only by salt / brand / code (e.g. Dolo 650 for
 *    "paracetamol": a same-salt substitute). Otherwise the list's order.
 *
 * The text of each item is built once and cached (items are immutable).
 */

export type SearchFields = {
  /** The main name — ranks first */
  name: string;
  /** Other words: salt, brand, category, city… */
  text?: readonly (string | null | undefined)[];
  /** Codes matched from the middle too: batch, barcode, bill no., phone… */
  codes?: readonly (string | null | undefined)[];
};

type Index = {
  name: string;
  nameWords: string[];
  words: string[];
  codes: string;
};

export type SearchQuery = { phrase: string; tokens: string[] };

const lower = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** "Dolo-650mg Tab" → dolo, 650mg, 650, mg, tab */
function wordsOf(text: string): string[] {
  const out: string[] = [];
  for (const w of lower(text).split(/[^\p{L}\p{N}%]+/u)) {
    if (!w) continue;
    out.push(w);
    const parts = w.match(/[\p{L}%]+|\p{N}+/gu);
    if (parts && parts.length > 1) out.push(...parts);
  }
  return out;
}

/** tablets → tablet, syrups → syrup, strips → strip, pharmacies → pharmacy */
function stem(t: string) {
  if (t.endsWith("ies") && t.length > 4) return `${t.slice(0, -3)}y`;
  if (t.endsWith("ses") && t.length > 4) return t.slice(0, -2);
  if (t.endsWith("s") && t.length > 3 && !t.endsWith("ss"))
    return t.slice(0, -1);
  return t;
}

export function parseQuery(query: string): SearchQuery {
  const phrase = lower(query);
  return {
    phrase,
    tokens: phrase.split(/[^\p{L}\p{N}%./-]+/u).filter(Boolean),
  };
}

const startsAny = (words: string[], t: string, s: string) =>
  words.some((w) => w.startsWith(t) || w.startsWith(s));

function tokenMatches(ix: Index, token: string): boolean {
  // "500/-", "a-1" → match on the letters/digits typed
  const t = token.replace(/[./-]+/g, "");
  if (!t) return true;
  if (startsAny(ix.words, t, stem(t))) return true;
  return t.length >= 3 && ix.codes.includes(t);
}

/**
 * Builds a search for one kind of item.
 *   const search = createSearch((m: Medicine) => ({ name: m.name, … }))
 *   search.filter(list, query)   → matching items, best first
 *   search.matches(item, query)  → true / false
 */
export function createSearch<T extends object>(
  fields: (item: T) => SearchFields,
) {
  const cache = new WeakMap<T, Index>();

  const index = (item: T): Index => {
    let ix = cache.get(item);
    if (!ix) {
      const f = fields(item);
      const nameWords = wordsOf(f.name);
      ix = {
        name: lower(f.name),
        nameWords,
        words: [...nameWords, ...wordsOf((f.text ?? []).join(" "))],
        // "98190 87654", "INV-0042" → 9819087654, inv0042
        codes: (f.codes ?? [])
          .map((c) => (c ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""))
          .filter(Boolean)
          .join(" "),
      };
      // Codes are words too ("inv-0042" → inv, 0042)
      ix.words.push(...wordsOf(ix.codes));
      cache.set(item, ix);
    }
    return ix;
  };

  /** -1 = no match · 0 name starts with it · 1 all words in name · 2 other */
  const rank = (item: T, q: SearchQuery): number => {
    if (!q.tokens.length) return 0;
    const ix = index(item);
    if (!q.tokens.every((t) => tokenMatches(ix, t))) return -1;
    if (ix.name.startsWith(q.phrase)) return 0;
    const inName = q.tokens.every((t) => {
      const c = t.replace(/[./-]+/g, "");
      return !c || startsAny(ix.nameWords, c, stem(c));
    });
    return inName ? 1 : 2;
  };

  return {
    rank,
    matches: (item: T, query: string) => rank(item, parseQuery(query)) >= 0,
    /**
     * Matching items, best first (ties keep the list's own order).
     * `keep` filters before ranking; `limit` cuts AFTER ranking, so the
     * best match is never lost.
     */
    filter<U extends T>(
      list: readonly U[],
      query: string,
      opts: { keep?: (item: U) => boolean; limit?: number } = {},
    ): U[] {
      const q = parseQuery(query);
      const keep = opts.keep;
      if (!q.tokens.length) {
        const all = keep ? list.filter(keep) : [...list];
        return opts.limit ? all.slice(0, opts.limit) : all;
      }
      const hits: { item: U; r: number; i: number }[] = [];
      list.forEach((item, i) => {
        if (keep && !keep(item)) return;
        const r = rank(item, q);
        if (r >= 0) hits.push({ item, r, i });
      });
      hits.sort((a, b) => a.r - b.r || a.i - b.i);
      const out = hits.map((h) => h.item);
      return opts.limit ? out.slice(0, opts.limit) : out;
    },
  };
}

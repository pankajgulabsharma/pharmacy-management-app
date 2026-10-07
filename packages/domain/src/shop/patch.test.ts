import { describe, expect, it } from "vitest";
import { upsertById } from "./patch";

describe("merging a patch", () => {
  const list = [{ id: "b", v: 1 }, { id: "a", v: 1 }];
  it("replaces known records in place and puts new ones first", () => {
    expect(upsertById(list, [{ id: "a", v: 2 }, { id: "c", v: 1 }])).toEqual([{ id: "c", v: 1 }, { id: "b", v: 1 }, { id: "a", v: 2 }]);
  });
  it("is safe to apply twice", () => {
    const once = upsertById(list, [{ id: "c", v: 1 }]);
    expect(upsertById(once, [{ id: "c", v: 1 }])).toEqual(once);
  });
});

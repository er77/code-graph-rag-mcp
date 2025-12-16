import { describe, expect, it } from "@jest/globals";
import { decodeCursor, encodeCursor } from "../../src/utils/cursor.js";

describe("cursor pagination helpers", () => {
  it("round-trips cursor payloads", () => {
    const cursor = encodeCursor({ o: 10, q: "abc" });
    const decoded = decodeCursor<{ o: number; q: string }>(cursor);
    expect(decoded).toEqual({ o: 10, q: "abc" });
  });

  it("supports offset-based paging", () => {
    const items = Array.from({ length: 12 }, (_, i) => i);
    const pageSize = 5;

    const page1 = items.slice(0, pageSize);
    const c1 = encodeCursor({ o: pageSize });
    const off1 = decodeCursor<{ o: number }>(c1)!.o;
    const page2 = items.slice(off1, off1 + pageSize);

    expect(page1).toEqual([0, 1, 2, 3, 4]);
    expect(page2).toEqual([5, 6, 7, 8, 9]);
  });
});

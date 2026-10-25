import { describe, test, expect } from "bun:test";
import { MemoryCache } from "../../src/core/cache/memory-cache";

describe("MemoryCache", () => {
  test("sets and gets fresh entries", () => {
    const cache = new MemoryCache<string>(1000);
    cache.set("city:jakarta", "data_jakarta");
    expect(cache.get("city:jakarta")).toBe("data_jakarta");
  });

  test("returns undefined for expired entries via get()", async () => {
    const cache = new MemoryCache<string>(50); // 50ms TTL
    cache.set("city:bandung", "data_bandung");
    expect(cache.get("city:bandung")).toBe("data_bandung");

    await new Promise((r) => setTimeout(r, 60));
    expect(cache.get("city:bandung")).toBeUndefined();
  });

  test("getAny() returns expired entries with isExpired: true", async () => {
    const cache = new MemoryCache<string>(50);
    cache.set("city:surabaya", "data_surabaya");

    await new Promise((r) => setTimeout(r, 60));
    const result = cache.getAny("city:surabaya");
    expect(result).toBeDefined();
    expect(result?.value).toBe("data_surabaya");
    expect(result?.isExpired).toBe(true);
  });

  test("delete and clear remove entries", () => {
    const cache = new MemoryCache<string>();
    cache.set("a", "1");
    cache.set("b", "2");
    expect(cache.size()).toBe(2);

    cache.delete("a");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size()).toBe(1);

    cache.clear();
    expect(cache.size()).toBe(0);
  });
});

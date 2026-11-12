import { afterEach, describe, expect, it, vi } from "vitest";

import { withTimeout } from "../../lib/util/async";

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("settles like the promise when it settles in time", async () => {
    await expect(withTimeout(Promise.resolve(42), 100)).resolves.toBe(42);
    await expect(
      withTimeout(Promise.reject(new Error("refused")), 100),
    ).rejects.toThrow("refused");
  });

  it("rejects with a timeout once the delay has elapsed", async () => {
    vi.useFakeTimers();

    const race = withTimeout(new Promise(() => {}), 100);
    const settled = expect(race).rejects.toThrow("timeout");
    await vi.advanceTimersByTimeAsync(100);

    await settled;
  });

  it("leaves no timer armed once settled", async () => {
    vi.useFakeTimers();

    await withTimeout(Promise.resolve(), 100);

    expect(vi.getTimerCount()).toBe(0);
  });
});

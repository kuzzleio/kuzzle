import { describe, expect, it } from "vitest";

import { BufferedPassThrough } from "../../lib/util/bufferedPassThrough";

/** Writes every chunk, ends the stream, and returns everything it emitted. */
async function roundTrip(
  stream: BufferedPassThrough,
  chunks: string[],
): Promise<Buffer> {
  const read: Buffer[] = [];

  stream.on("data", (chunk: Buffer) => read.push(Buffer.from(chunk)));

  for (const chunk of chunks) {
    stream.write(chunk);
  }
  stream.end();

  await new Promise((resolve) => stream.once("end", resolve));

  return Buffer.concat(read);
}

describe("#BufferedPassThrough", () => {
  it("accumulates chunks and emits the same bytes", async () => {
    const stream = new BufferedPassThrough({ highWaterMark: 8 });

    expect((await roundTrip(stream, ["abc", "def", "ghij"])).toString()).toBe(
      "abcdefghij",
    );
  });

  // `highWaterMark` is optional on DuplexOptions, and the constructor's default
  // argument only covers the no-argument call: every other shape reached
  // `Buffer.alloc(undefined)`, which throws ERR_INVALID_ARG_TYPE.
  it("falls back to the default buffer size when none is given", async () => {
    expect(() => new BufferedPassThrough({})).not.toThrow();

    const stream = new BufferedPassThrough({ objectMode: false });

    expect((await roundTrip(stream, ["hello"])).toString()).toBe("hello");
  });

  it("works with no options at all", async () => {
    expect(
      (await roundTrip(new BufferedPassThrough(), ["hi"])).toString(),
    ).toBe("hi");
  });

  // `_destroy` runs after `_final` on a stream that ended normally, and both
  // flush the tail. The offset reset is what stops the tail being pushed twice
  // — it used to be `this.buffer = null`, which is why the field was declared
  // `Buffer` and assigned `null`.
  it("does not emit the tail twice when destroyed after ending", async () => {
    const stream = new BufferedPassThrough({ highWaterMark: 64 });
    const out = await roundTrip(stream, ["tail"]);

    stream.destroy();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(out.toString()).toBe("tail");
  });
});

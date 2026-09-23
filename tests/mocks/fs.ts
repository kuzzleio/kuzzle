/**
 * A fake `node:fs`, holding only what a subject under test actually calls.
 *
 * It is a module-level singleton because `vi.mock`'s factory is hoisted above
 * everything a spec writes: the object the mocked module answers has to exist
 * before the first import, so tests reach for {@link resetFs} in a
 * `beforeEach` rather than building a new one.
 */
import { vi } from "vitest";

/** A read stream whose `pipe` chains and whose `on("finish")` fires at once. */
function stubStream() {
  const stream = {
    on: vi.fn((_event: string, listener: () => void) => {
      listener();

      return stream;
    }),
    pipe: vi.fn(() => stream),
  };

  return stream;
}

export const readStream = stubStream();

export const fs = {
  accessSync: vi.fn(),
  /** The real values, so a subject that ORs them gets a number. */
  constants: { R_OK: 4, W_OK: 2, X_OK: 1 },
  copyFileSync: vi.fn(),
  createReadStream: vi.fn(() => readStream),
  createWriteStream: vi.fn(),
  existsSync: vi.fn(() => false),
  lstatSync: vi.fn(() => ({ isFile: () => true })),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn((): string[] => []),
  readFileSync: vi.fn(),
  rmSync: vi.fn(),
  statSync: vi.fn(),
  unlinkSync: vi.fn(),
  writeFileSync: vi.fn(),
};

/** Puts every stub back to the behaviour declared above. */
export function resetFs(): void {
  for (const value of [...Object.values(fs), ...Object.values(readStream)]) {
    if (vi.isMockFunction(value)) {
      value.mockReset();
    }
  }

  fs.createReadStream.mockReturnValue(readStream);
  fs.existsSync.mockReturnValue(false);
  fs.lstatSync.mockReturnValue({ isFile: () => true });
  fs.readdirSync.mockReturnValue([]);
  readStream.pipe.mockReturnValue(readStream);
  readStream.on.mockImplementation((_event: string, listener: () => void) => {
    listener();

    return readStream;
  });
}

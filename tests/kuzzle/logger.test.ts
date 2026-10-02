import { createRequire } from "module";
import { Writable } from "stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BadRequestError } from "../../lib/kerror/errors";
import { Logger } from "../../lib/kuzzle/Logger";

// The pino instance of kuzzle-logger, whose transport is replaced by an
// in-memory stream so that the serialized entries can be read back
const pino = createRequire(require.resolve("kuzzle-logger"))("pino");

describe("Logger", () => {
  let lines: any[];

  beforeEach(() => {
    lines = [];
    (Logger as any).basePino = undefined;

    vi.spyOn(pino, "transport").mockReturnValue(
      new Writable({
        write(chunk, _encoding, callback) {
          lines.push(JSON.parse(chunk.toString()));
          callback();
        },
      }),
    );
  });

  afterEach(() => {
    (Logger as any).basePino = undefined;
    vi.restoreAllMocks();
  });

  function createLogger(namespace = "app") {
    return new Logger(
      {
        plugins: { common: { failsafeMode: false } },
        server: { appLogs: {} },
      } as any,
      namespace,
    );
  }

  it("logs errors under err, with their message, stack and properties", () => {
    const logger = createLogger();

    logger.error(new BadRequestError("missing argument", "api.assert.foo"));

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      err: {
        id: "api.assert.foo",
        message: "missing argument",
        name: "BadRequestError",
        status: 400,
      },
      failsafeMode: false,
      msg: "missing argument",
      namespace: "app",
    });
    expect(lines[0].err.stack).toContain("missing argument");
  });

  it("keeps the merging object and the error serialization in child loggers", () => {
    const logger = createLogger().child("browser");

    logger.warn({ err: new Error("boom") }, "Something failed");

    expect(lines[0]).toMatchObject({
      err: { message: "boom", name: "Error" },
      msg: "Something failed",
      namespace: "app:browser",
    });
  });
});

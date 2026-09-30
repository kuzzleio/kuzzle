import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Funnel from "../../../lib/api/funnel";
import DumpGenerator from "../../../lib/kuzzle/dumpGenerator";
import { fs, resetFs } from "../../mocks/fs";
import { restoreKuzzle, stubKuzzle, stubLogger } from "../../mocks/kuzzle";

vi.mock("node:fs", async () => {
  const { fs: stub } = await import("../../mocks/fs");

  return { ...stub, default: stub };
});

vi.mock("dumpme", async () => {
  const { dumpme } = await import("../../kuzzle/dumpGeneratorFixture");

  return { default: dumpme };
});

/** The subject dumps from a `setImmediate`, so the assertions queue behind one. */
const afterImmediate = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

/**
 * The automatic "handled error" dump, down to the real `DumpGenerator`: the
 * suffix the funnel builds has to pass the generator's own check, and a dump
 * that fails anyway must not escape as an unhandled rejection (step 15, F-05).
 */
describe("#api/funnel.handleErrorDump", () => {
  const year = new Date().getFullYear();

  let funnel: Funnel;
  let generator: DumpGenerator;
  let logger: ReturnType<typeof stubLogger>;

  beforeEach(() => {
    resetFs();

    // No dump history to clean: `accessSync` throwing says so.
    fs.accessSync.mockImplementation(() => {
      throw new Error("deactivated");
    });
    fs.readdirSync.mockReturnValue([]);

    logger = stubLogger();

    stubKuzzle({
      config: {
        dump: {
          dateFormat: "YYYY",
          enabled: true,
          handledErrors: {
            enabled: true,
            minInterval: 0,
            whitelist: ["TypeError"],
          },
          history: { coredump: 3, reports: 5 },
          path: "/tmp",
        },
        /* Read by the funnel's constructor. */
        limits: { loginsPerSecond: 1 },
      },
      dump: (suffix: string) => generator.dump(suffix),
      log: logger,
      pluginsManager: { getPluginsDescription: () => ({}) },
      statistics: { getAllStats: async () => ({ hits: [] }) },
    });

    generator = new DumpGenerator();
    funnel = new Funnel();
  });

  afterEach(() => {
    restoreKuzzle();
    vi.restoreAllMocks();
  });

  /** The dump directories the generator created. */
  const created = () => fs.mkdirSync.mock.calls.map(([target]) => target);

  it("dumps a handled error whose message is longer than a suffix allows", async () => {
    const dumped = vi.spyOn(generator, "dump");

    funnel.handleErrorDump(
      new TypeError(
        "Cannot read properties of undefined (reading 'someProperty') at the far end of a plugin",
      ),
    );
    await afterImmediate();

    const suffix =
      "handled-typeerror-cannot-read-properties-of-undefined-reading-so";

    expect(suffix).toHaveLength(64);
    expect(dumped).toHaveBeenCalledExactlyOnceWith(suffix);
    await expect(dumped.mock.results[0]?.value).resolves.toBe(
      `/tmp/${year}-${suffix}`,
    );
    expect(created()).toEqual([`/tmp/${year}-${suffix}`]);
  });

  it("slugifies an error type the suffix check would refuse", async () => {
    const dumped = vi.spyOn(generator, "dump");
    const error = new TypeError("boom");

    global.kuzzle.config.dump.handledErrors.whitelist = ["Plugin Error.ñ"];
    error.name = "Plugin Error.ñ";

    funnel.handleErrorDump(error);
    await afterImmediate();

    expect(dumped).toHaveBeenCalledExactlyOnceWith("handled-plugin-error-boom");
    await expect(dumped.mock.results[0]?.value).resolves.toBe(
      `/tmp/${year}-handled-plugin-error-boom`,
    );
  });

  it("logs a dump that fails instead of leaving the rejection unhandled", async () => {
    fs.mkdirSync.mockImplementation(() => {
      throw new Error("EACCES: permission denied, mkdir '/tmp/dump'");
    });

    funnel.handleErrorDump(new TypeError("boom"));
    await afterImmediate();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /^Unable to dump after a handled error: Unable to create dump folder/,
        ),
      ),
    );
  });
});

import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DumpGenerator from "../../lib/kuzzle/dumpGenerator";
import packageJson from "../../package.json";
import { BadRequestError } from "../../lib/kerror/errors/badRequestError";
import { PreconditionError } from "../../lib/kerror/errors/preconditionError";
import { invalid } from "../helpers/invalid";
import { fs, resetFs } from "../mocks/fs";
import { restoreKuzzle, stubKuzzle, stubLogger } from "../mocks/kuzzle";

vi.mock("node:fs", async () => {
  const { fs: stub } = await import("../mocks/fs");

  return { ...stub, default: stub };
});

vi.mock("dumpme", async () => {
  const { dumpme } = await import("./dumpGeneratorFixture");

  return { default: dumpme };
});

/** `_dump` is the lock, and `_listFilesMatching` is stubbed by one test. */
type Internals = {
  _dump: boolean;
  _listFilesMatching: (directory: string, start: string) => string[];
};

const internalsOf = (generator: DumpGenerator) => invalid<Internals>(generator);

describe("#kuzzle/DumpGenerator", () => {
  const suffix = "dump-me-master";
  const year = new Date().getFullYear();
  const dumpPath = `/tmp/${year}-${suffix}`;

  let generator: DumpGenerator;
  let config: Record<string, any>;
  let logger: ReturnType<typeof stubLogger>;
  let getPluginsDescription: ReturnType<typeof vi.fn>;
  let getAllStats: ReturnType<typeof vi.fn>;
  let dumpme: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    resetFs();

    ({ dumpme } = await import("./dumpGeneratorFixture"));
    dumpme.mockClear();

    /* The history clean-up is off by default: `accessSync` throwing is how the
     * subject decides there is nothing to clean. */
    fs.accessSync.mockImplementation(() => {
      throw new Error("deactivated");
    });
    fs.readdirSync.mockReturnValue(["core"]);
    fs.statSync.mockReturnValue({
      birthtime: new Date("1979-12-28 14:56"),
      isDirectory: () => true,
    });

    logger = stubLogger();
    getPluginsDescription = vi.fn(() => ({ foo: {} }));
    getAllStats = vi.fn(async () => ({ hits: [{ stats: 42 }] }));

    config = {
      dump: {
        dateFormat: "YYYY",
        enabled: true,
        history: { coredump: 3, reports: 5 },
        path: "/tmp",
      },
    };

    stubKuzzle({
      config,
      log: logger,
      pluginsManager: { getPluginsDescription },
      statistics: { getAllStats },
    });

    generator = new DumpGenerator();
  });

  afterEach(() => {
    restoreKuzzle();
    vi.restoreAllMocks();
  });

  /** The payload written to one of the dump's files, parsed. */
  const written = (file: string) => {
    const call = fs.writeFileSync.mock.calls.find(
      ([target]) => target === path.join(dumpPath, file),
    );

    expect(call, `${file} was not written`).toBeDefined();

    return JSON.parse(call![1] as string);
  };

  describe("#dump", () => {
    it("should refuse to run while a dump is in progress", async () => {
      internalsOf(generator)._dump = true;

      await expect(generator.dump(suffix)).rejects.toMatchObject({
        constructor: PreconditionError,
        id: "api.process.action_locked",
      });
    });

    it("should refuse a suffix that escapes the dump directory", async () => {
      const rejection = generator.dump("test/../../../../dumpe-me");

      await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection).rejects.toThrow(/Invalid argument "suffix"/);

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    /* A client reads an error by its id: the check used to raise a bare
     * `BadRequestError`, with neither an id nor a code (step 15, F-05). */
    it("should reject a malformed suffix with a documented error id", async () => {
      await expect(generator.dump("a".repeat(65))).rejects.toMatchObject({
        code: 0x02010002,
        id: "api.assert.invalid_argument",
        status: 400,
      });
    });

    /**
     * [TD-81](../../docs/adr-001/type-debt-register.md#td-81): the lock used to
     * be taken before the arguments were checked and released only on the
     * success path, so one rejected request disabled dumping for the lifetime
     * of the process. Each failure path below is followed by a dump that must
     * succeed.
     */
    it("should not hold the lock after a rejected suffix — TD-81", async () => {
      await expect(
        generator.dump("test/../../../../dumpe-me"),
      ).rejects.toBeInstanceOf(BadRequestError);

      await expect(generator.dump(suffix)).resolves.toBe(dumpPath);
    });

    it("should release the lock when the generation fails — TD-81", async () => {
      fs.mkdirSync.mockImplementationOnce(() => {
        throw new Error("EACCES: permission denied, mkdir '/tmp/dump'");
      });

      await expect(generator.dump(suffix)).rejects.toThrow(
        /Unable to create dump folder/,
      );

      await expect(generator.dump(suffix)).resolves.toBe(dumpPath);
    });

    it("should hold the lock for the whole generation", async () => {
      let finishStats!: () => void;

      getAllStats.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishStats = () => resolve({ hits: [] });
          }),
      );

      const first = generator.dump(suffix);

      await vi.waitFor(() => expect(getAllStats).toHaveBeenCalled());

      await expect(generator.dump(suffix)).rejects.toMatchObject({
        id: "api.process.action_locked",
      });

      finishStats();

      await expect(first).resolves.toBe(dumpPath);
      await expect(generator.dump(suffix)).resolves.toBe(dumpPath);
    });

    it("should keep the cause when the dump folder cannot be created", async () => {
      const cause = new Error("EACCES: permission denied, mkdir '/tmp/dump'");

      fs.mkdirSync.mockImplementation(() => {
        throw cause;
      });

      const rejection = await generator.dump(suffix).catch((error) => error);

      expect(rejection.message).toBe(
        `Unable to create dump folder: ${cause.message}`,
      );
      expect(rejection.cause).toBe(cause);
    });

    it("should report an already existing dump folder as such", async () => {
      fs.mkdirSync.mockImplementation(() => {
        throw new Error("EEXIST: file already exists");
      });

      await expect(generator.dump(suffix)).rejects.toThrow(
        "Dump directory already exists. Skipping..",
      );
    });

    it("should answer the path it dumped into", async () => {
      await expect(generator.dump(suffix)).resolves.toBe(dumpPath);

      expect(fs.mkdirSync).toHaveBeenCalledExactlyOnceWith(dumpPath, {
        recursive: true,
      });
    });

    it("should dump the configuration and the running version", async () => {
      await generator.dump(suffix);

      expect(written("kuzzle.json")).toEqual({
        config,
        version: packageJson.version,
      });
    });

    /* ⚠️ `plugins.json` holds what `getPluginsDescription()` answers. The Mocha
     * spec set `pluginsManager.plugins` to the same object and asserted
     * against *that*, so a subject dumping the wrong one of the two would
     * have passed. */
    it("should dump the plugins' description", async () => {
      getPluginsDescription.mockReturnValue({ "lambda-core": { hooks: [] } });

      await generator.dump(suffix);

      expect(getPluginsDescription).toHaveBeenCalled();
      expect(written("plugins.json")).toEqual({
        "lambda-core": { hooks: [] },
      });
    });

    it("should dump the Node.js and OS configurations", async () => {
      await generator.dump(suffix);

      expect(Object.keys(written("nodejs.json")).sort()).toEqual([
        "argv",
        "config",
        "env",
        "moduleLoadList",
        "release",
        "versions",
      ]);

      const os = written("os.json");

      expect(Object.keys(os).sort()).toEqual([
        "cpus",
        "loadavg",
        "mem",
        "networkInterfaces",
        "platform",
        "uptime",
      ]);
      expect(Object.keys(os.mem).sort()).toEqual(["free", "total"]);
    });

    it("should dump the statistics' hits", async () => {
      await generator.dump(suffix);

      expect(getAllStats).toHaveBeenCalledWith();
      expect(written("statistics.json")).toEqual([{ stats: 42 }]);
    });

    it("should generate a core dump and gzip it", async () => {
      await generator.dump(suffix);

      expect(dumpme).toHaveBeenCalledWith("gcore", `${dumpPath}/core`);

      expect(fs.createReadStream).toHaveBeenCalledWith(`${dumpPath}/core`);
      expect(fs.createWriteStream).toHaveBeenCalledExactlyOnceWith(
        `${dumpPath}/core.gz`,
      );
      /* The original core is removed once the gzip stream has finished — the
       * `finish` listener is the only place that happens. */
      expect(fs.unlinkSync).toHaveBeenCalledWith(`${dumpPath}/core`);
    });

    it("should use the configured core dump command", async () => {
      config.dump.gcore = "/usr/bin/gcore-13";

      await generator.dump(suffix);

      expect(dumpme).toHaveBeenCalledWith(
        "/usr/bin/gcore-13",
        `${dumpPath}/core`,
      );
    });

    /* The subject warns instead of dumping when `dumpme` produced nothing —
     * nothing asserted the empty half. */
    it("should warn when no core file was produced", async () => {
      fs.readdirSync.mockReturnValue([]);

      await generator.dump(suffix);

      expect(fs.createReadStream).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith("> could not generate dump");
    });

    it("should copy the node binary", async () => {
      await generator.dump(suffix);

      expect(fs.copyFileSync).toHaveBeenCalledWith(
        process.execPath,
        path.join(dumpPath, "node"),
      );
    });

    /* The lock is released at the end, and a generator that never released it
     * would refuse every dump after the first. */
    it("should release the lock once done", async () => {
      await generator.dump(suffix);
      await expect(generator.dump(suffix)).resolves.toBe(dumpPath);
    });
  });

  describe("#_cleanUpHistory", () => {
    /** Ten entries, all directories, and a readable dump path. */
    const tenDumps = () => {
      fs.accessSync.mockImplementation((target: unknown) => {
        if (target === "/tmp") {
          return undefined;
        }

        throw new Error("no coredump here");
      });
      fs.readdirSync.mockReturnValue([
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10",
      ]);
    };

    /* ⚠️ Both of the Mocha tests for this asserted `fs.removeSync` — an
     * `fs-extra` method the subject has never called. The assertion could not
     * fail, in either direction. The subject removes directories with
     * `rmSync` and core files with `unlinkSync`. */
    it("should clean nothing when the dump path is not reachable", async () => {
      fs.accessSync.mockImplementation(() => {
        throw new Error("foobar");
      });

      await generator.dump(suffix);

      expect(fs.rmSync).not.toHaveBeenCalled();
      /* The dump's own core file is still cleaned up — that is the gzip step,
       * not the history. */
      expect(fs.unlinkSync).not.toHaveBeenCalledWith(
        expect.stringMatching(/^\/tmp\/\d+\//),
      );
    });

    it("should clean nothing while under both limits", async () => {
      fs.accessSync.mockImplementation((target: unknown) => {
        if (target === "/tmp") {
          return undefined;
        }

        throw new Error("no coredump here");
      });
      fs.readdirSync.mockReturnValue(["foo", "bar"]);

      await generator.dump(suffix);

      expect(fs.rmSync).not.toHaveBeenCalled();
    });

    it("should delete the oldest report directories over the limit", async () => {
      tenDumps();
      fs.statSync.mockReturnValue({
        birthtime: new Date("1979-12-28 14:56"),
        isDirectory: () => true,
      });
      fs.statSync.mockReturnValueOnce({
        birthtime: new Date("1979-11-13 01:13"),
        isDirectory: () => false,
      });

      await generator.dump(suffix);

      /* Nine directories for a limit of five: four over, plus one for the dump
       * about to be created. */
      expect(fs.rmSync).toHaveBeenCalledTimes(5);
    });

    /* `history.reports: 0` makes `dumps.length >= reports` constant-true, so
     * the loop ran once past the end and read `.path` off `undefined`. */
    it("should not crash when history.reports is 0", async () => {
      config.dump.history.reports = 0;
      fs.accessSync.mockImplementation((target: unknown) => {
        if (target === "/tmp") {
          return undefined;
        }

        throw new Error("no coredump here");
      });
      fs.readdirSync.mockReturnValue(["foo", "bar"]);

      await generator.dump(suffix);

      expect(fs.rmSync).toHaveBeenCalledTimes(2);
    });

    it("should delete the core files of the reports it keeps", async () => {
      tenDumps();
      config.dump.history.reports = 100;

      const listFilesMatching = vi
        .spyOn(internalsOf(generator), "_listFilesMatching")
        .mockImplementation((directory: string) => [`${directory}/core.gz`]);

      await generator.dump(suffix);

      /* Ten dumps, `coredump: 3` kept: the seven oldest lose their core. */
      for (const i of [1, 2, 3, 4, 5, 6, 7]) {
        expect(listFilesMatching).toHaveBeenCalledWith(`/tmp/${i}`, "core");
        expect(fs.unlinkSync).toHaveBeenCalledWith(`/tmp/${i}/core.gz`);
      }

      for (const i of [8, 9, 10]) {
        expect(fs.unlinkSync).not.toHaveBeenCalledWith(`/tmp/${i}/core.gz`);
      }
    });

    /* `slice(0, dumps.length - coredump)` with a negative end counts from the
     * end of the list: two dumps for `coredump: 3` lost the oldest one's core
     * file (step 15, F-05). */
    it("should keep every core file while under the coredump limit", async () => {
      fs.accessSync.mockImplementation((target: unknown) => {
        if (target === "/tmp") {
          return undefined;
        }

        throw new Error("no coredump here");
      });
      fs.readdirSync.mockReturnValue(["1", "2"]);

      const listFilesMatching = vi
        .spyOn(internalsOf(generator), "_listFilesMatching")
        .mockImplementation((directory: string) => [`${directory}/core.gz`]);

      await generator.dump(suffix);

      expect(listFilesMatching).not.toHaveBeenCalledWith("/tmp/1", "core");
      expect(fs.unlinkSync).not.toHaveBeenCalledWith("/tmp/1/core.gz");
      expect(fs.unlinkSync).not.toHaveBeenCalledWith("/tmp/2/core.gz");
    });
  });
});

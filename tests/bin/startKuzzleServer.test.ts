import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `bin/start-kuzzle-server.ts` is the production container's entrypoint, and
 * it runs on import: it parses `process.argv` and starts a `Backend`. The
 * `Backend` is replaced by a recorder, so what is under test is the script's
 * own handling of its options.
 */
const app = vi.hoisted(() => ({
  import: {
    mappings: vi.fn(),
    profiles: vi.fn(),
    roles: vi.fn(),
    users: vi.fn(),
  },
  log: { warn: vi.fn() },
  plugin: { use: vi.fn() },
  sdk: {
    query: vi.fn(),
    security: { searchUsers: vi.fn(async () => ({ total: 1 })) },
  },
  start: vi.fn(async () => {}),
  vault: {} as Record<string, string>,
  version: "",
}));

vi.mock("../../index", () => ({
  Backend: function Backend() {
    return app;
  },
}));

const originalArgv = process.argv;

function startWith(...args: string[]): Promise<unknown> {
  process.argv = ["node", "start-kuzzle-server", ...args];

  return import("../../bin/start-kuzzle-server");
}

describe("start-kuzzle-server", () => {
  let exit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    exit = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  describe("--enable-plugins", () => {
    // The published build has no `bin/plugins/`: v2.56.0 ignored the option,
    // and TD-84's parsing fix had turned it into a `MODULE_NOT_FOUND` at boot.
    it("skips a plugin that is not there with a warning, and still starts", async () => {
      await startWith("--enable-plugins", "no-such-plugin, other-missing");

      await vi.waitFor(() => {
        expect(app.sdk.security.searchUsers).toHaveBeenCalled();
      });

      expect(exit).not.toHaveBeenCalled();
      expect(app.start).toHaveBeenCalledOnce();
      expect(app.plugin.use).not.toHaveBeenCalled();
      expect(app.log.warn).toHaveBeenCalledTimes(2);
      expect(app.log.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /--enable-plugins: plugin "no-such-plugin" not found/,
        ),
      );
      expect(app.log.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /--enable-plugins: plugin "other-missing" not found/,
        ),
      );
    });

    it("still loads a plugin that is there (source checkout)", async () => {
      await startWith("--enable-plugins", "functional-test-plugin");

      await vi.waitFor(() => {
        expect(app.sdk.security.searchUsers).toHaveBeenCalled();
      });

      expect(exit).not.toHaveBeenCalled();
      expect(app.log.warn).not.toHaveBeenCalled();
      expect(app.plugin.use).toHaveBeenCalledOnce();
      expect(app.plugin.use).toHaveBeenCalledWith(expect.anything(), {
        manifest: expect.objectContaining({ name: "functional-test-plugin" }),
        name: "functional-test-plugin",
      });
    });
  });

  describe("option values", () => {
    it("names a numeric value for what it is, not as a missing one", async () => {
      await expect(startWith("--vault-key", "12345")).rejects.toThrow(
        "--vault-key expects a single string value, got 12345",
      );
    });

    it("says a flag given without a value expects one", async () => {
      await expect(startWith("--fixtures")).rejects.toThrow(
        "--fixtures expects a value",
      );
    });
  });
});

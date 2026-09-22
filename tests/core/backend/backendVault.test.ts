import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Backend } from "../../../lib/core/backend/backend";
import { createBackend, internals } from "./backendFixture";

vi.mock("../../../lib/kuzzle", async () => {
  const { FakeKuzzle } = await import("./fakeKuzzle");

  return { Kuzzle: FakeKuzzle, default: FakeKuzzle };
});

describe("BackendVault", () => {
  let application: Backend;

  beforeEach(async () => {
    application = await createBackend();
  });

  describe("#key", () => {
    it("sets the vault key", () => {
      application.vault.key = "unforeseen-consequences";

      expect(internals(application)._vaultKey).toBe("unforeseen-consequences");
    });

    it("throws if the application is already started", () => {
      internals(application).started = true;

      expect(() => {
        application.vault.key = "unforeseen-consequences";
      }).toThrow(
        expect.objectContaining({ id: "plugin.runtime.already_started" }),
      );
    });
  });

  describe("#file", () => {
    it("sets the vault file", () => {
      application.vault.file = "xen.bmp";

      expect(internals(application)._secretsFile).toBe("xen.bmp");
    });

    it("throws if the application is already started", () => {
      internals(application).started = true;

      expect(() => {
        application.vault.file = "xen.bmp";
      }).toThrow(
        expect.objectContaining({ id: "plugin.runtime.already_started" }),
      );
    });
  });

  describe("#secrets", () => {
    it("exposes Kuzzle's vault secrets once the application is started", () => {
      internals(application).started = true;
      internals(application)._kuzzle = {
        vault: { secrets: { beware: "vortigaunt" } },
      };

      expect(application.vault.secrets).toEqual({ beware: "vortigaunt" });
    });
  });
});

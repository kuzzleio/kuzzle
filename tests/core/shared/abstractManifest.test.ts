import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import AbstractManifest from "../../../lib/core/shared/abstractManifest";

/**
 * `load()` reads the manifest with a bare `require`, so the fixture has to be a
 * real file on disk — and in a fresh directory per test, since `require`
 * caches by resolved path.
 */
function writeManifest(content: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "kuzzle-manifest-"));

  writeFileSync(
    join(dir, "manifest.json"),
    typeof content === "string" ? content : JSON.stringify(content),
  );

  return dir;
}

function expectKerror(fn: () => unknown, id: string) {
  let thrown: unknown;

  try {
    fn();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(Error);
  expect(thrown).toMatchObject({ id });
}

describe("#core/shared/AbstractManifest", () => {
  beforeEach(() => {
    (globalThis as { kuzzle?: unknown }).kuzzle = {
      config: { version: "2.56.0" },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("#constructor", () => {
    it("resolves the manifest path and leaves the rest unset", () => {
      const manifest = new AbstractManifest("/some/plugin");

      expect(manifest.path).toBe("/some/plugin");
      expect(manifest.manifestPath).toBe("/some/plugin/manifest.json");
      expect(manifest.name).toBeNull();
      expect(manifest.kuzzleVersion).toBeNull();
      expect(manifest.raw).toBeNull();
    });
  });

  describe("#load", () => {
    it("reads name and kuzzleVersion from the manifest", () => {
      const dir = writeManifest({
        kuzzleVersion: ">=2.0.0",
        name: "my-plugin",
      });
      const manifest = new AbstractManifest(dir);

      manifest.load();

      expect(manifest.name).toBe("my-plugin");
      expect(manifest.kuzzleVersion).toBe(">=2.0.0");
      expect(manifest.raw).toMatchObject({ name: "my-plugin" });
    });

    it("throws plugin.manifest.cannot_load when the file is missing", () => {
      const manifest = new AbstractManifest("/does/not/exist");

      expectKerror(() => manifest.load(), "plugin.manifest.cannot_load");
    });

    it("throws plugin.manifest.cannot_load when the file is not valid JSON", () => {
      const dir = writeManifest("{ not json");
      const manifest = new AbstractManifest(dir);

      expectKerror(() => manifest.load(), "plugin.manifest.cannot_load");
    });

    it("throws plugin.manifest.missing_version when kuzzleVersion is absent", () => {
      const dir = writeManifest({ name: "my-plugin" });
      const manifest = new AbstractManifest(dir);

      expectKerror(() => manifest.load(), "plugin.manifest.missing_version");
    });

    it("throws plugin.manifest.version_mismatch when the running version is out of range", () => {
      const dir = writeManifest({
        kuzzleVersion: ">=99.0.0",
        name: "my-plugin",
      });
      const manifest = new AbstractManifest(dir);

      expectKerror(() => manifest.load(), "plugin.manifest.version_mismatch");
    });

    it("accepts a prerelease running version — includePrerelease is set", () => {
      (globalThis as { kuzzle?: unknown }).kuzzle = {
        config: { version: "2.57.0-beta.1" },
      };
      const dir = writeManifest({
        kuzzleVersion: ">=2.0.0",
        name: "my-plugin",
      });
      const manifest = new AbstractManifest(dir);

      expect(() => manifest.load()).not.toThrow();
    });

    it("throws plugin.manifest.invalid_name_type when name is not a non-empty string", () => {
      for (const name of [42, "", {}]) {
        const dir = writeManifest({ kuzzleVersion: ">=2.0.0", name });
        const manifest = new AbstractManifest(dir);

        expectKerror(
          () => manifest.load(),
          "plugin.manifest.invalid_name_type",
        );
      }
    });

    it("throws plugin.manifest.missing_name when name is absent", () => {
      const dir = writeManifest({ kuzzleVersion: ">=2.0.0" });
      const manifest = new AbstractManifest(dir);

      expectKerror(() => manifest.load(), "plugin.manifest.missing_name");
    });
  });

  describe("#toJSON", () => {
    // Deliberately narrow: server:info serialises this, and `raw` must not
    // leak (it can carry a circular kuzzle reference).
    it("exposes only kuzzleVersion, name and path", () => {
      const dir = writeManifest({
        kuzzleVersion: ">=2.0.0",
        name: "my-plugin",
      });
      const manifest = new AbstractManifest(dir);

      manifest.load();

      expect(manifest.toJSON()).toEqual({
        kuzzleVersion: ">=2.0.0",
        name: "my-plugin",
        path: dir,
      });
      expect(JSON.stringify(manifest)).not.toContain("raw");
    });
  });
});

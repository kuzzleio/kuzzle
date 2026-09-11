import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import PluginManifest from "../../../lib/core/plugin/pluginManifest";

/**
 * `load()` reads the manifest with a bare `require`, so the fixture has to be a
 * real file on disk — and in a fresh directory per test, since `require`
 * caches by resolved path.
 */
function writeManifest(content: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "kuzzle-plugin-manifest-"));

  writeFileSync(
    join(dir, "manifest.json"),
    // kuzzleVersion is required by AbstractManifest and is not what these
    // tests are about
    JSON.stringify({ kuzzleVersion: ">=2.0.0 <3.0.0", ...content }),
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

describe("#core/plugin/PluginManifest", () => {
  beforeEach(() => {
    (globalThis as { kuzzle?: unknown }).kuzzle = {
      config: { version: "2.56.0" },
    };
  });

  it("defaults privileged to false", () => {
    const manifest = new PluginManifest("/some/plugin");

    expect(manifest.privileged).toBe(false);
  });

  it("loads a valid manifest and keeps privileged false when absent", () => {
    const manifest = new PluginManifest(writeManifest({ name: "a-plugin" }));

    manifest.load();

    expect(manifest.name).toBe("a-plugin");
    expect(manifest.privileged).toBe(false);
  });

  it("reads the privileged flag", () => {
    const manifest = new PluginManifest(
      writeManifest({ name: "a-plugin", privileged: true }),
    );

    manifest.load();

    expect(manifest.privileged).toBe(true);
  });

  it("rejects a name Elasticsearch would not accept as an index", () => {
    const manifest = new PluginManifest(
      writeManifest({ name: "not a valid name" }),
    );

    expectKerror(() => manifest.load(), "plugin.manifest.invalid_name");
  });

  it("rejects a non-boolean privileged flag", () => {
    const manifest = new PluginManifest(
      writeManifest({ name: "a-plugin", privileged: "yes" }),
    );

    expectKerror(() => manifest.load(), "plugin.manifest.invalid_privileged");
  });
});

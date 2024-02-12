"use strict";

const should = require("should");
const rewire = require("rewire");

const { PluginImplementationError } = require("../../../index");
const KuzzleMock = require("../../mocks/kuzzle.mock");

describe("AbstractManifest class", () => {
  const defaultKuzzleVersion = ">=2.0.0 <3.0.0";
  const pluginPath = "foo/bar";

  let Manifest;

  function mockRequireManifest(manifest) {
    return Manifest.__with__("require", (m) => {
      if (m.endsWith(`${pluginPath}/manifest.json`)) {
        return manifest;
      }
      return require(m);
    });
  }

  beforeEach(() => {
    new KuzzleMock();
    Manifest = rewire("../../../lib/core/shared/abstractManifest");
  });

  it("should throw if no manifest.json is found", () => {
    const manifest = new Manifest(pluginPath);

    should(() => manifest.load()).throw(PluginImplementationError, {
      id: "plugin.manifest.cannot_load",
    });
  });

  it("should throw if kuzzleVersion is not a string", () => {
    const manifest = new Manifest(pluginPath);

    mockRequireManifest({ kuzzleVersion: 123, name: "foobar" })(() => {
      should(() => manifest.load()).throw(PluginImplementationError, {
        id: "plugin.manifest.version_mismatch",
      });
    });
  });

  it("should throw if kuzzleVersion is not present", () => {
    const manifest = new Manifest(pluginPath);

    mockRequireManifest({ name: "foobar" })(() => {
      should(() => manifest.load()).throw(PluginImplementationError, {
        id: "plugin.manifest.missing_version",
      });
    });
  });

  it("should set the provided kuzzleVersion value", () => {
    const kuzzleVersion = ">1.0.0 <=99.99.99";
    const manifest = new Manifest(pluginPath);

    mockRequireManifest({ kuzzleVersion, name: "foobar" })(() => {
      manifest.load();
      should(manifest).match({ kuzzleVersion, name: "foobar" });
    });
  });

  it("should accept a prerelease kuzzleVersion value", () => {
    const kuzzleVersion = ">2.27.0-beta.1";
    const manifest = new Manifest(pluginPath);

    mockRequireManifest({ kuzzleVersion, name: "foobar" })(() => {
      manifest.load();
      should(manifest).match({ kuzzleVersion, name: "foobar" });
    });
  });

  it("should throw if the provided name is not a non-empty string", () => {
    const manifest = new Manifest(pluginPath);

    for (const name of [123, false, ""]) {
      mockRequireManifest({ kuzzleVersion: defaultKuzzleVersion, name })(() => {
        should(() => manifest.load()).throw(PluginImplementationError, {
          id: "plugin.manifest.invalid_name_type",
        });
      });
    }
  });

  it("should throw if no name property is provided", () => {
    const manifest = new Manifest(pluginPath);

    for (const name of [undefined, null]) {
      mockRequireManifest({ kuzzleVersion: defaultKuzzleVersion, name })(() => {
        should(() => manifest.load()).throw(PluginImplementationError, {
          id: "plugin.manifest.missing_name",
        });
      });
    }
  });

  it("should throw if kuzzleVersion does not match the current Kuzzle version", () => {
    const kuzzleVersion = ">0.4.2 <1.0.0";
    const manifest = new Manifest(pluginPath);

    mockRequireManifest({ kuzzleVersion, name: "foobar" })(() => {
      should(() => manifest.load()).throw(PluginImplementationError, {
        id: "plugin.manifest.version_mismatch",
      });
    });
  });

  it("should serialize only the necessary properties", () => {
    const manifest = new Manifest(pluginPath);

    mockRequireManifest({
      kuzzleVersion: defaultKuzzleVersion,
      name: "foobar",
    })(() => {
      manifest.load();

      const serialized = JSON.parse(JSON.stringify(manifest));

      should(serialized).eql({
        kuzzleVersion: manifest.kuzzleVersion,
        name: manifest.name,
        path: manifest.path,
      });
    });
  });
});

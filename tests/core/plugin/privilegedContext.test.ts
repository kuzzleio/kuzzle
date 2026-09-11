import { describe, expect, it, vi } from "vitest";

import PrivilegedPluginContext from "../../../lib/core/plugin/privilegedContext";

vi.mock("../../../lib/core/plugin/pluginContext", () => ({
  PluginContext: class {
    public accessors: Record<string, unknown> = {};

    constructor(public readonly pluginName: string) {}
  },
}));

describe("#core/plugin/PrivilegedPluginContext", () => {
  it("is a plugin context with the Kuzzle instance added to its accessors", () => {
    const kuzzle = { id: "node-1" };

    (globalThis as { kuzzle?: unknown }).kuzzle = kuzzle;

    const context = new PrivilegedPluginContext("a-plugin");

    expect(context.accessors.kuzzle).toBe(kuzzle);
  });
});

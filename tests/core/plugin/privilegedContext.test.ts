import { afterEach, beforeEach, describe, expect, it } from "vitest";

import PrivilegedPluginContext from "../../../lib/core/plugin/privilegedContext";
import { PluginContext } from "../../../lib/core/plugin/pluginContext";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/*
 * Nothing here stubs PluginContext: a PrivilegedPluginContext *is* a
 * PluginContext plus one assignment, so a spec that mocks the base class
 * asserts an assignment to a field it declared itself and would pass with the
 * base deleted (TD-46). Loading the real base is what TD-49 unblocked —
 * pluginContext -> index -> funnel -> controllers used to die on a require()
 * vite left for Node's resolver.
 */
describe("#core/plugin/PrivilegedPluginContext", () => {
  beforeEach(() => {
    /*
     * The constructor binds `global.kuzzle.validation.{addType,validate}`;
     * the shared fixture stays minimal, so the spec pins what it needs.
     */
    stubKuzzle({ validation: { addType: () => {}, validate: () => {} } });
  });

  afterEach(() => {
    restoreKuzzle();
  });

  it("is a complete plugin context", () => {
    const context = new PrivilegedPluginContext("a-plugin");

    expect(context).toBeInstanceOf(PluginContext);
    expect(context.accessors.sdk).toBeDefined();
    expect(context.accessors.storage).toBeDefined();
    expect(context.errors).toBeDefined();
    expect(context.constructors).toBeDefined();
  });

  it("additionally carries the Kuzzle instance in its accessors", () => {
    const context = new PrivilegedPluginContext("a-plugin");

    expect(context.accessors.kuzzle).toBe(global.kuzzle);
  });
});

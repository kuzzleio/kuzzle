"use strict";

const mockrequire = require("mock-require"),
  should = require("should"),
  KuzzleMock = require("../../../mocks/kuzzle.mock");

/*
 * This is the spec that exercises the REAL PluginContext: KuzzleMock gives it a
 * global.kuzzle and nothing here stubs the base class. A vitest spec added
 * beside it in #2724 mocked PluginContext outright, so it asserted an
 * assignment to a field on a stub it declared itself and would have passed with
 * PluginContext deleted; it was removed in the TD-46 (#2733) pass rather than
 * kept as a second, weaker witness. Porting this one to vitest needs the tree
 * to be able to load lib/api/controllers first — see TD-49.
 */
describe("Privileged Plugin Context", () => {
  let PrivilegedPluginContext;

  beforeEach(() => {
    mockrequire.reRequire("../../../../lib/core/plugin/pluginContext");
    PrivilegedPluginContext = mockrequire.reRequire(
      "../../../../lib/core/plugin/privilegedContext",
    );
  });

  describe("#constructor", () => {
    it("should expose kuzzle and new constructors", () => {
      const kuzzle = new KuzzleMock(),
        privilegedContext = new PrivilegedPluginContext("pluginName");

      should(privilegedContext.accessors.kuzzle).be.exactly(kuzzle);
    });
  });
});

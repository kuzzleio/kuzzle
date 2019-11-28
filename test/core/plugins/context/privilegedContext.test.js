const
  mockrequire = require('mock-require'),
  should = require('should'),
  KuzzleMock = require('../../../mocks/kuzzle.mock');

describe('Privileged Plugin Context', () => {
  let
    PrivilegedPluginContext;

  beforeEach(() => {
    mockrequire.reRequire('../../../../lib/core/plugins/context');
    PrivilegedPluginContext = mockrequire.reRequire('../../../../lib/core/plugins/privilegedContext');
  });

  describe('#constructor', () => {
    it('should expose kuzzle and new constructors', () => {
      const
        kuzzle = new KuzzleMock(),
        privilegedContext = new PrivilegedPluginContext(kuzzle, 'pluginName');

      should(privilegedContext.accessors.kuzzle).be.exactly(kuzzle);
    });
  });
});

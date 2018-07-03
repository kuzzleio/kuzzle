const
  mockrequire = require('mock-require'),
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../../../mocks/kuzzle.mock');
  
describe('Privileged Plugin Context', () => {
  let
    PrivilegedPluginContext;

  beforeEach(() => {
    mockrequire('../../../../lib/services/internalEngine', function () {
      this.init = sinon.spy();
      this.bootstrap = {
        all: sinon.spy(),
        createCollection: sinon.spy()
      };
    });
    mockrequire.reRequire('../../../../lib/api/core/plugins/pluginContext');
    PrivilegedPluginContext = mockrequire.reRequire('../../../../lib/api/core/plugins/privilegedPluginContext');
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

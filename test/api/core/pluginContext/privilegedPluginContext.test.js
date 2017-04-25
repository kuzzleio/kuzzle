const
  should = require('should'),
  PrivilegedPluginContext = require('../../../../lib/api/core/plugins/privilegedPluginContext'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  PluginContext = require('../../../../lib/api/core/plugins/pluginContext'),
  WsBrokerClient = require('../../../../lib/services/broker/wsBrokerClient'),
  WsBrokerServer = require('../../../../lib/services/broker/wsBrokerServer');

describe('Privileged Plugin Context', () => {
  describe('#constructor', () => {
    it('should expose kuzzle and new constructors', () => {
      const
        kuzzle = new KuzzleMock(),
        privilegedContext = new PrivilegedPluginContext(kuzzle, 'pluginName');

      should(privilegedContext).be.instanceOf(PluginContext);
      should(privilegedContext.accessors.kuzzle).be.exactly(kuzzle);
      should(privilegedContext.constructors.services.WsBrokerClient).be.exactly(WsBrokerClient);
      should(privilegedContext.constructors.services.WsBrokerServer).be.exactly(WsBrokerServer);
    });
  });
});

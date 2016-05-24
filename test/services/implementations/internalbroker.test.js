var
  q = require('q'),
  rewire = require('rewire'),
  should = require('should'),
  WSClientMock = require('../../mocks/services/ws.mock'),
  WSServerMock = require('../../mocks/services/ws.server.mock'),
  InternalBroker = require.main.require('lib/services/internalbroker'),
  WSBrokerClient = require.main.require('lib/services/broker/wsBrokerClient'),
  WSBrokerServer = require.main.require('lib/services/broker/wsBrokerServer');


describe('Test: Internal broker', function () {
  var
    client1, client2, client3,
    server,
    kuzzle;

  before(() => {
    kuzzle = {
      config: {
        broker: {
          host: 'host',
          port: 'port'
        }
      },
      pluginsManager: {
        trigger: () => {}
      }
    };

    server = new InternalBroker(kuzzle, {isServer: true});
    server.handler.ws = (options, cb) => {
      cb();
      return new WSServerMock();
    };

    client1 = new InternalBroker(kuzzle, {isServer: false});
    client2 = new InternalBroker(kuzzle, {isServer: false});
    client3 = new InternalBroker(kuzzle, {isServer: false});
    client1.handler.ws = client2.handler.ws = client3.handler.ws = () => new WSClientMock(server.handler.server);

    return q.all([
      server.init(),
      client1.init(),
      client2.init(),
      client3.init()
    ]);
  });


  describe('#constructor', () => {

    it('should instanciate a handler', () => {
      should(client1.handler).be.an.instanceOf(WSBrokerClient);
      should(server.handler).be.an.instanceOf(WSBrokerServer);
    });

  });

  describe('Client', () => {

    describe('#constructor', () => {

      it('should', () => {

      });

    });

  });
});


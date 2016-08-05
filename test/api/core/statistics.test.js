/*
  This component collects statistics and made them available to the admin controller
 */
var
  _ = require('lodash'),
  should = require('should'),
  Promise = require('bluebird'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Kuzzle = require.main.require('lib/api/kuzzle'),
  Redis = rewire('../../../lib/services/redis'),
  RedisClientMock = require('../../mocks/services/redisClient.mock'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  Statistics = rewire('../../../lib/api/core/statistics');

describe('Test: statistics core component', () => {
  var
    requestObject,
    kuzzle,
    dbname = 'unit-tests',
    stats,
    lastFrame = Date.now(),
    fakeStats = {
      connections: { foo: 42 },
      ongoingRequests: { bar: 1337 },
      completedRequests: { baz: 666 },
      failedRequests: { qux: 667 }
    };

  before(() => {
    kuzzle = new Kuzzle();
    kuzzle.config.cache.databases.push(dbname);
    kuzzle.services.list.statsCache = new Redis(kuzzle, {service: dbname});
    return Redis.__with__('buildClient', () => new RedisClientMock())(() => {
      return kuzzle.services.list.statsCache.init()
        .then(() => kuzzle.services.list.statsCache.volatileSet(lastFrame, JSON.stringify(fakeStats), 30))
        .then(() => kuzzle.services.list.statsCache.volatileSet(lastFrame + 100, JSON.stringify(fakeStats), 30));
    });
  });

  beforeEach(() => {
    requestObject = new RequestObject({
      controller: 'admin',
      action: '',
      requestId: 'foo',
      collection: '',
      body: {}
    });

    stats = new Statistics(kuzzle);
  });

  afterEach(() => {
    sandbox.restore();
  });


  it('should initialize with a set of exposed methods', () => {
    should(stats.startRequest).be.a.Function();
    should(stats.completedRequest).be.a.Function();
    should(stats.failedRequest).be.a.Function();
    should(stats.newConnection).be.a.Function();
    should(stats.dropConnection).be.a.Function();
    should(stats.getStats).be.a.Function();
    should(stats.getLastStats).be.a.Function();
    should(stats.getAllStats).be.a.Function();
  });

  it('should register a new request when asked to', () => {
    requestObject.protocol = 'foobar';
    stats.startRequest(requestObject);
    should(stats.currentStats.ongoingRequests.foobar).not.be.undefined().and.be.exactly(1);
    stats.startRequest(requestObject);
    should(stats.currentStats.ongoingRequests.foobar).not.be.undefined().and.be.exactly(2);
  });

  it('should do nothing when startRequest is called with invalid arguments', () => {
    should(stats.startRequest()).be.false();
    should(stats.currentStats.ongoingRequests).be.empty();
    should(stats.startRequest(requestObject)).be.false();
    should(stats.currentStats.ongoingRequests).be.empty();
  });

  it('should handle completed requests', () => {
    stats.currentStats.ongoingRequests.foobar = 2;
    requestObject.protocol = 'foobar';
    stats.completedRequest(requestObject);
    should(stats.currentStats.ongoingRequests.foobar).not.be.undefined().and.be.exactly(1);
    should(stats.currentStats.completedRequests.foobar).not.be.undefined().and.be.exactly(1);
    stats.completedRequest(requestObject);
    should(stats.currentStats.ongoingRequests.foobar).not.be.undefined().and.be.exactly(0);
    should(stats.currentStats.completedRequests.foobar).not.be.undefined().and.be.exactly(2);
  });

  it('should do nothing when completedRequest is called with invalid arguments', () => {
    should(stats.completedRequest()).be.false();
    should(stats.currentStats.completedRequests).be.empty();
    should(stats.completedRequest(requestObject)).be.false();
    should(stats.currentStats.completedRequests).be.empty();
  });

  it('should handle failed requests', () => {
    stats.currentStats.ongoingRequests.foobar = 2;
    requestObject.protocol = 'foobar';
    stats.failedRequest(requestObject);
    should(stats.currentStats.ongoingRequests.foobar).not.be.undefined().and.be.exactly(1);
    should(stats.currentStats.failedRequests.foobar).not.be.undefined().and.be.exactly(1);
    stats.failedRequest(requestObject);
    should(stats.currentStats.ongoingRequests.foobar).not.be.undefined().and.be.exactly(0);
    should(stats.currentStats.failedRequests.foobar).not.be.undefined().and.be.exactly(2);
  });

  it('should do nothing when failedRequest is called with invalid arguments', () => {
    should(stats.failedRequest()).be.false();
    should(stats.currentStats.failedRequests).be.empty();
    should(stats.failedRequest(requestObject)).be.false();
    should(stats.currentStats.failedRequests).be.empty();
  });

  it('should handle new connections', () => {
    var connection = {type: 'foobar'};
    stats.newConnection(connection);
    should(stats.currentStats.connections.foobar).not.be.undefined().and.be.exactly(1);
    stats.newConnection(connection);
    should(stats.currentStats.connections.foobar).not.be.undefined().and.be.exactly(2);
  });

  it('should do nothing when newConnection is called with invalid arguments', () => {
    should(stats.newConnection()).be.false();
    should(stats.currentStats.connections).be.empty();
    should(stats.newConnection(requestObject)).be.false();
    should(stats.currentStats.connections).be.empty();
  });

  it('should be able to unregister a connection', () => {
    var connection = {type: 'foobar'};

    stats.currentStats.connections.foobar = 2;
    stats.dropConnection(connection);
    should(stats.currentStats.connections.foobar).be.exactly(1);
    stats.dropConnection(connection);
    should(stats.currentStats.connections.foobar).be.undefined();
  });

  it('should do nothing when dropConnection is called with invalid arguments', () => {
    should(stats.dropConnection()).be.false();
    should(stats.currentStats.connections).be.empty();
    should(stats.dropConnection(requestObject)).be.false();
    should(stats.currentStats.connections).be.empty();
  });

  it('should return the current frame when there is still no statistics in cache', () => {
    stats.currentStats = fakeStats;
    requestObject.data.body.startTime = lastFrame - 10000000;
    requestObject.data.body.stopTime = new Date(new Date().getTime() + 10000);

    return stats.getStats(requestObject)
      .then(response => {
        should(response.hits).be.an.Array();
        should(response.hits).have.length(1);
        should(response.total).be.exactly(1);

        ['completedRequests', 'connections', 'failedRequests', 'ongoingRequests'].forEach(k => {
          should(response.hits[0][k]).match(fakeStats[k]);
        });
        should(response.hits[0].timestamp).be.a.Number();
      });
  });

  it('should return the current frame from the cache when statistics snapshots have been taken', () => {
    stats.lastFrame = lastFrame;
    requestObject.data.body.startTime = lastFrame - 1000;
    requestObject.data.body.stopTime = new Date(new Date().getTime() + 100000);

    sandbox.stub(kuzzle.services.list.statsCache, 'getAllKeys').resolves([lastFrame, lastFrame + 100]);
    sandbox.stub(kuzzle.services.list.statsCache, 'mget').resolves([JSON.stringify(fakeStats), JSON.stringify(fakeStats)]);

    return stats.getStats(requestObject)
      .then(response => {
        should(response.hits).be.an.Array();
        should(response.hits).have.length(2);
        should(response.total).be.exactly(2);
        ['completedRequests', 'connections', 'failedRequests', 'ongoingRequests'].forEach(k => {
          should(response.hits[0][k]).match(fakeStats[k]);
        });
        should(response.hits[0].timestamp).be.a.Number();
      });
  });

  it('should return an empty statistics because the asked date is in the future', () => {
    stats.lastFrame = lastFrame;
    requestObject.data.body.startTime = new Date(new Date().getTime() + 10000);

    return stats.getStats(requestObject)
      .then(response => {
        should(response.hits).be.an.Array();
        should(response.hits).have.length(0);
        should(response.total).be.exactly(0);
      });
  });

  it('should return all statistics because startTime is not defined', () => {
    stats.lastFrame = lastFrame;
    requestObject.data.body.stopTime = new Date();

    sandbox.stub(kuzzle.services.list.statsCache, 'getAllKeys').resolves([lastFrame, lastFrame + 100]);
    sandbox.stub(kuzzle.services.list.statsCache, 'mget').resolves([JSON.stringify(fakeStats), JSON.stringify(fakeStats)]);

    return stats.getStats(requestObject)
      .then(response => {
        should(response.hits).be.an.Array();
        should(response.hits).have.length(2);
        should(response.total).be.exactly(2);
      });
  });

  it('should get the last frame from the cache when statistics snapshots have been taken', () => {
    stats.lastFrame = lastFrame;
    sandbox.stub(kuzzle.services.list.statsCache, 'get').resolves(JSON.stringify(fakeStats));

    stats.getLastStats(requestObject)
      .then(response => {
        should(response).be.an.Object();
        ['completedRequests', 'connections', 'failedRequests', 'ongoingRequests'].forEach(k => {
          should(response[k]).match(fakeStats[k]);
        });
        should(response.timestamp).be.a.Number();
      });
  });

  it('should return the current frame instead of all statistics if no cache has been initialized', () => {
    stats.currentStats = fakeStats;

    return stats.getAllStats(requestObject)
      .then(response => {
        should(response.hits).be.an.Array();
        should(response.hits).have.length(1);
        should(response.total).be.exactly(1);
        ['completedRequests', 'connections', 'failedRequests', 'ongoingRequests'].forEach(k => {
          should(response.hits[0][k]).match(fakeStats[k]);
        });
      });
  });

  it('should return all saved statistics', () => {
    stats.lastFrame = lastFrame;

    sandbox.stub(kuzzle.services.list.statsCache, 'getAllKeys').resolves([lastFrame, lastFrame + 100]);
    sandbox.stub(kuzzle.services.list.statsCache, 'mget').resolves([JSON.stringify(fakeStats), JSON.stringify(fakeStats)]);

    return stats.getAllStats(requestObject)
      .then(response => {
        should(response.hits).be.an.Array();
        should(response.hits).have.length(2);
        should(response.total).be.exactly(2);
        ['completedRequests', 'connections', 'failedRequests', 'ongoingRequests'].forEach(k => {
          should(response.hits[0][k]).match(fakeStats[k]);
        });
        should(response.hits[0].timestamp).be.a.Number();
        ['completedRequests', 'connections', 'failedRequests', 'ongoingRequests'].forEach(k => {
          should(response.hits[1][k]).match(fakeStats[k]);
        });
        should(response.hits[1].timestamp).be.a.Number();
      });
  });

  it('should manage statistics errors', () => {
    stats.lastFrame = lastFrame;
    requestObject.data.body.startTime = 'a string';
    requestObject.data.body.stopTime = 'a string';

    return should(stats.getAllStats(requestObject)).be.rejectedWith(BadRequestError);
  });

  it('should write statistics frames in cache', () => {
    var
      writeStats = Statistics.__get__('writeStats'),
      spy = sandbox.stub(kuzzle.services.list.statsCache, 'volatileSet').resolves();

    stats.currentStats = _.extend({}, fakeStats);

    writeStats.call(stats);

    should(stats.currentStats.completedRequest).be.empty();
    should(stats.currentStats.failedRequests).be.empty();
    should(spy.calledOnce).be.true();
    should(spy.calledWith(stats.lastFrame, JSON.stringify(fakeStats), stats.ttl)).be.true();
  });

  it('should reject the promise if the cache returns an error', () => {
    var statsCache = kuzzle.services.list.statsCache;

    kuzzle.services.list.statsCache = {
      get: () => { return Promise.reject(new Error()); }
    };

    stats.lastFrame = Date.now();

    return should(
      stats.getLastStats(requestObject)
        .catch(error => {
          kuzzle.services.list.statsCache = statsCache;
          return Promise.reject(error);
        })
    ).be.rejected();
  });
});


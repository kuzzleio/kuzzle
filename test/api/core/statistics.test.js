const
  _ = require('lodash'),
  should = require('should'),
  rewire = require('rewire'),
  Kuzzle = require('../../mocks/kuzzle.mock'),
  Request = require('kuzzle-common-objects').Request,
  RequestContext = require('kuzzle-common-objects').models.RequestContext,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  Statistics = rewire('../../../lib/api/core/statistics');

describe('Test: statistics core component', () => {
  let
    request,
    kuzzle,
    stats;
  const
    lastFrame = Date.now(),
    fakeStats = {
      connections: { foo: 42 },
      ongoingRequests: { bar: 1337 },
      completedRequests: { baz: 666 },
      failedRequests: { qux: 667 }
    };

  before(() => {
    kuzzle = new Kuzzle();
  });

  beforeEach(() => {
    request = new Request({
      controller: 'server',
      action: '',
      requestId: 'foo',
      collection: '',
      body: {}
    });

    stats = new Statistics(kuzzle);
  });

  afterEach(() => {
    if (stats.timer) {
      clearTimeout(stats.timer);
    }
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
    request.context.protocol = 'foobar';
    stats.startRequest(request);
    should(stats.currentStats.ongoingRequests.foobar).not.be.undefined().and.be.exactly(1);
    stats.startRequest(request);
    should(stats.currentStats.ongoingRequests.foobar).not.be.undefined().and.be.exactly(2);
  });

  it('should do nothing when startRequest is called with invalid arguments', () => {
    should(stats.startRequest()).be.false();
    should(stats.currentStats.ongoingRequests).be.empty();
    should(stats.startRequest(request)).be.false();
    should(stats.currentStats.ongoingRequests).be.empty();
  });

  it('should handle completed requests', () => {
    stats.currentStats.ongoingRequests.foobar = 2;
    request.context.protocol = 'foobar';
    stats.completedRequest(request);
    should(stats.currentStats.ongoingRequests.foobar).not.be.undefined().and.be.exactly(1);
    should(stats.currentStats.completedRequests.foobar).not.be.undefined().and.be.exactly(1);
    stats.completedRequest(request);
    should(stats.currentStats.ongoingRequests.foobar).not.be.undefined().and.be.exactly(0);
    should(stats.currentStats.completedRequests.foobar).not.be.undefined().and.be.exactly(2);
  });

  it('should do nothing when completedRequest is called with invalid arguments', () => {
    should(stats.completedRequest()).be.false();
    should(stats.currentStats.completedRequests).be.empty();
    should(stats.completedRequest(request)).be.false();
    should(stats.currentStats.completedRequests).be.empty();
  });

  it('should handle failed requests', () => {
    stats.currentStats.ongoingRequests.foobar = 2;
    request.context.protocol = 'foobar';

    stats.failedRequest(request);
    should(stats.currentStats.ongoingRequests.foobar).not.be.undefined().and.be.exactly(1);
    should(stats.currentStats.failedRequests.foobar).not.be.undefined().and.be.exactly(1);
    stats.failedRequest(request);
    should(stats.currentStats.ongoingRequests.foobar).not.be.undefined().and.be.exactly(0);
    should(stats.currentStats.failedRequests.foobar).not.be.undefined().and.be.exactly(2);
  });

  it('should do nothing when failedRequest is called with invalid arguments', () => {
    should(stats.failedRequest()).be.false();
    should(stats.currentStats.failedRequests).be.empty();
    should(stats.failedRequest(request)).be.false();
    should(stats.currentStats.failedRequests).be.empty();
  });

  it('should handle new connections', () => {
    const context = new RequestContext({protocol: 'foobar'});
    stats.newConnection(context);
    should(stats.currentStats.connections.foobar).not.be.undefined().and.be.exactly(1);
    stats.newConnection(context);
    should(stats.currentStats.connections.foobar).not.be.undefined().and.be.exactly(2);
  });

  it('should be able to unregister a connection', () => {
    const context = new RequestContext({protocol: 'foobar'});

    stats.currentStats.connections.foobar = 2;
    stats.dropConnection(context);
    should(stats.currentStats.connections.foobar).be.exactly(1);
    stats.dropConnection(context);
    should(stats.currentStats.connections.foobar).be.undefined();
  });

  it('should return the current frame when there is still no statistics in cache', () => {
    stats.currentStats = fakeStats;
    request.input.args.startTime = lastFrame - 10000000;
    request.input.args.stopTime = new Date(new Date().getTime() + 10000);

    return stats.getStats(request)
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
    request.input.args.startTime = lastFrame - 1000;
    request.input.args.stopTime = new Date(new Date().getTime() + 100000);

    kuzzle.services.list.internalCache.searchKeys.resolves([
      '{stats/}' + lastFrame,
      '{stats/}'.concat(lastFrame + 100)
    ]);

    kuzzle.services.list.internalCache.mget.resolves([
      JSON.stringify(fakeStats),
      JSON.stringify(fakeStats)
    ]);

    return stats.getStats(request)
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
    request.input.args.startTime = new Date(new Date().getTime() + 10000);

    return stats.getStats(request)
      .then(response => {
        should(response.hits).be.an.Array();
        should(response.hits).have.length(0);
        should(response.total).be.exactly(0);
      });
  });

  it('should return all statistics because startTime is not defined', () => {
    stats.lastFrame = lastFrame;
    request.input.args.stopTime = lastFrame + 1000;

    kuzzle.services.list.internalCache.searchKeys.resolves([
      '{stats/}' + lastFrame,
      '{stats/}'.concat(lastFrame + 100)
    ]);
    kuzzle.services.list.internalCache.mget.resolves([
      JSON.stringify(fakeStats),
      JSON.stringify(fakeStats)
    ]);

    return stats.getStats(request)
      .then(response => {
        should(response.hits).be.an.Array();
        should(response.hits).have.length(2);
        should(response.total).be.exactly(2);
      });
  });

  it('should manage statistics errors', () => {
    stats.lastFrame = lastFrame;
    request.input.args.startTime = 'a string';
    request.input.args.stopTime = 'a string';

    return should(stats.getStats(request)).be.rejectedWith(BadRequestError);
  });

  it('should get the last frame from the cache when statistics snapshots have been taken', () => {
    stats.lastFrame = lastFrame;
    kuzzle.services.list.internalCache.get.resolves(JSON.stringify(fakeStats));

    stats.getLastStats()
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

    return stats.getAllStats()
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

    kuzzle.services.list.internalCache.searchKeys.resolves([
      '{stats/}' + lastFrame,
      '{stats/}'.concat(lastFrame + 100)
    ]);
    kuzzle.services.list.internalCache.mget.resolves([
      JSON.stringify(fakeStats),
      JSON.stringify(fakeStats)
    ]);

    return stats.getAllStats()
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

  it('should write statistics frames in cache', () => {
    const writeStats = Statistics.__get__('writeStats');

    kuzzle.services.list.internalCache.setex.resolves();

    stats.currentStats = _.extend({}, fakeStats);

    writeStats.call(stats);

    should(stats.currentStats.completedRequests).be.empty();
    should(stats.currentStats.failedRequests).be.empty();
    should(kuzzle.services.list.internalCache.setex)
      .calledOnce()
      .calledWith('{stats/}' + stats.lastFrame, stats.ttl, JSON.stringify(fakeStats));
  });

  it('should reject the promise if the cache returns an error', () => {
    stats.lastFrame = Date.now();

    kuzzle.services.list.internalCache.get.rejects(new Error());

    return should(stats.getLastStats(request)).be.rejected();
  });
});


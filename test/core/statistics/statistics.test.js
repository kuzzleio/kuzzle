'use strict';

const should = require('should');
const rewire = require('rewire');
const Kuzzle = require('../../mocks/kuzzle.mock');
const Statistics = rewire('../../../lib/core/statistics/statistics');
const {
  Request,
  RequestContext,
  BadRequestError
} = require('kuzzle-common-objects');

describe('Test: statistics core component', () => {
  let request;
  let kuzzle;
  let stats;
  const lastFrame = Date.now();
  const fakeStats = {
    connections: new Map(),
    ongoingRequests: new Map(),
    completedRequests: new Map(),
    failedRequests: new Map()
  };

  before(() => {
    kuzzle = new Kuzzle();
    fakeStats.connections.set('foo', 42 );
    fakeStats.ongoingRequests.set('bar', 1337 );
    fakeStats.completedRequests.set('baz', 666 );
    fakeStats.failedRequests.set('qux', 667 );
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
    should(stats.currentStats.ongoingRequests.get('foobar')).not.be.undefined().and.be.exactly(1);
    stats.startRequest(request);
    should(stats.currentStats.ongoingRequests.get('foobar')).not.be.undefined().and.be.exactly(2);
  });

  it('should do nothing when startRequest is called with invalid arguments', () => {
    stats.startRequest();
    should(stats.currentStats.ongoingRequests).be.empty();

    stats.startRequest(request);
    should(stats.currentStats.ongoingRequests).be.empty();
  });

  it('should handle completed requests', () => {
    stats.currentStats.ongoingRequests.set('foobar', 2);
    request.context.protocol = 'foobar';
    stats.completedRequest(request);
    should(stats.currentStats.ongoingRequests.get('foobar')).not.be.undefined().and.be.exactly(1);
    should(stats.currentStats.completedRequests.get('foobar')).not.be.undefined().and.be.exactly(1);
    stats.completedRequest(request);
    should(stats.currentStats.ongoingRequests.get('foobar')).not.be.undefined().and.be.exactly(0);
    should(stats.currentStats.completedRequests.get('foobar')).not.be.undefined().and.be.exactly(2);
  });

  it('should do nothing when completedRequest is called with invalid arguments', () => {
    stats.completedRequest();
    should(stats.currentStats.completedRequests).be.empty();

    stats.completedRequest(request);
    should(stats.currentStats.completedRequests).be.empty();
  });

  it('should handle failed requests', () => {
    stats.currentStats.ongoingRequests.set('foobar', 2);
    request.context.protocol = 'foobar';

    stats.failedRequest(request);
    should(stats.currentStats.ongoingRequests.get('foobar')).not.be.undefined().and.be.exactly(1);
    should(stats.currentStats.failedRequests.get('foobar')).not.be.undefined().and.be.exactly(1);
    stats.failedRequest(request);
    should(stats.currentStats.ongoingRequests.get('foobar')).not.be.undefined().and.be.exactly(0);
    should(stats.currentStats.failedRequests.get('foobar')).not.be.undefined().and.be.exactly(2);
  });

  it('should do nothing when failedRequest is called with invalid arguments', () => {
    stats.failedRequest();
    should(stats.currentStats.failedRequests).be.empty();

    stats.failedRequest(request);
    should(stats.currentStats.failedRequests).be.empty();
  });

  it('should handle new connections', () => {
    const context = new RequestContext({connection: {protocol: 'foobar'}});
    stats.newConnection(context);
    should(stats.currentStats.connections.get('foobar')).not.be.undefined().and.be.exactly(1);
    stats.newConnection(context);
    should(stats.currentStats.connections.get('foobar')).not.be.undefined().and.be.exactly(2);
  });

  it('should be able to unregister a connection', () => {
    const context = new RequestContext({connection: {protocol: 'foobar'}});

    stats.currentStats.connections.set('foobar', 2);
    stats.dropConnection(context);
    should(stats.currentStats.connections.get('foobar')).be.exactly(1);
    stats.dropConnection(context);
    should(stats.currentStats.connections.get('foobar')).be.undefined();
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
          should(response.hits[0][k]).match(Object.fromEntries(fakeStats[k]));
        });
        should(response.hits[0].timestamp).be.a.Number();
      });
  });

  it('should return the current frame from the cache when statistics snapshots have been taken', () => {
    stats.lastFrame = lastFrame;
    request.input.args.startTime = lastFrame - 1000;
    request.input.args.stopTime = new Date(new Date().getTime() + 100000);

    kuzzle.cacheEngine.internal.searchKeys.resolves([
      '{stats/}' + lastFrame,
      '{stats/}'.concat(lastFrame + 100)
    ]);

    const returnedFakeStats = {
      completedRequests: Object.fromEntries(fakeStats.completedRequests),
      connections: Object.fromEntries(fakeStats.connections),
      failedRequests: Object.fromEntries(fakeStats.failedRequests),
      ongoingRequests: Object.fromEntries(fakeStats.ongoingRequests)
    };

    kuzzle.cacheEngine.internal.mget.resolves([
      JSON.stringify(returnedFakeStats),
      JSON.stringify(returnedFakeStats)
    ]);

    return stats.getStats(request)
      .then(response => {
        should(response.hits).be.an.Array();
        should(response.hits).have.length(2);
        should(response.total).be.exactly(2);
        ['completedRequests', 'connections', 'failedRequests', 'ongoingRequests'].forEach(k => {
          should(response.hits[0][k]).match(Object.fromEntries(fakeStats[k]));
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

    kuzzle.cacheEngine.internal.searchKeys.resolves([
      '{stats/}' + lastFrame,
      '{stats/}'.concat(lastFrame + 100)
    ]);
    kuzzle.cacheEngine.internal.mget.resolves([
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

  it('should get the last frame from the cache when statistics snapshots have been taken', async () => {
    stats.lastFrame = lastFrame;
    const returnedFakeStats = {
      completedRequests: Object.fromEntries(fakeStats.completedRequests),
      connections: Object.fromEntries(fakeStats.connections),
      failedRequests: Object.fromEntries(fakeStats.failedRequests),
      ongoingRequests: Object.fromEntries(fakeStats.ongoingRequests)
    };

    kuzzle.cacheEngine.internal.get.resolves(JSON.stringify(returnedFakeStats));

    const response = await stats.getLastStats();

    should(response).be.an.Object();

    ['completedRequests', 'connections', 'failedRequests', 'ongoingRequests'].forEach(k => {
      should(response[k]).match(Object.fromEntries(fakeStats[k]));
    });
    should(response.timestamp).be.approximately(Date.now(), 500);
  });

  it('should return the current frame instead of all statistics if no cache has been initialized', () => {
    stats.currentStats = fakeStats;

    return stats.getAllStats()
      .then(response => {
        should(response.hits).be.an.Array();
        should(response.hits).have.length(1);
        should(response.total).be.exactly(1);
        ['completedRequests', 'connections', 'failedRequests', 'ongoingRequests'].forEach(k => {
          should(response.hits[0][k]).match(Object.fromEntries(fakeStats[k]));
        });
      });
  });

  it('should return all saved statistics', () => {
    stats.lastFrame = lastFrame;

    kuzzle.cacheEngine.internal.searchKeys.resolves([
      '{stats/}' + lastFrame,
      '{stats/}'.concat(lastFrame + 100)
    ]);

    const returnedFakeStats = {
      completedRequests: Object.fromEntries(fakeStats.completedRequests),
      connections: Object.fromEntries(fakeStats.connections),
      failedRequests: Object.fromEntries(fakeStats.failedRequests),
      ongoingRequests: Object.fromEntries(fakeStats.ongoingRequests)
    };
    kuzzle.cacheEngine.internal.mget.resolves([
      JSON.stringify(returnedFakeStats),
      JSON.stringify(returnedFakeStats)
    ]);

    return stats.getAllStats()
      .then(response => {
        should(response.hits).be.an.Array();
        should(response.hits).have.length(2);
        should(response.total).be.exactly(2);
        ['completedRequests', 'connections', 'failedRequests', 'ongoingRequests'].forEach(k => {
          should(response.hits[0][k]).match(Object.fromEntries(fakeStats[k]));
        });
        should(response.hits[0].timestamp).be.a.Number();
        ['completedRequests', 'connections', 'failedRequests', 'ongoingRequests'].forEach(k => {
          should(response.hits[1][k]).match(Object.fromEntries(fakeStats[k]));
        });
        should(response.hits[1].timestamp).be.a.Number();
      });
  });

  it('should write statistics frames in cache', () => {
    const writeStats = Statistics.__get__('writeStats');

    kuzzle.cacheEngine.internal.setex.resolves();

    stats.currentStats = Object.assign({}, fakeStats);

    writeStats.call(stats);

    should(stats.currentStats.completedRequests).be.empty();
    should(stats.currentStats.failedRequests).be.empty();
    should(kuzzle.cacheEngine.internal.setex)
      .calledOnce()
      .calledWith('{stats/}' + stats.lastFrame, stats.ttl, JSON.stringify(fakeStats));
  });

  it('should reject the promise if the cache returns an error', () => {
    stats.lastFrame = Date.now();

    kuzzle.cacheEngine.internal.get.rejects(new Error());

    return should(stats.getLastStats(request)).be.rejected();
  });
});

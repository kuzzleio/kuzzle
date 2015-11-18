/*
  This component collects statistics and made them available to the admin controller
 */
var
  should = require('should'),
  winston = require('winston'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  Statistics = rewire('../../../lib/api/core/statistics');

require('should-promised');

describe('Test: statistics core component', function () {
  var
    requestObject,
    kuzzle,
    stats,
    lastFrame = Date.now(),
    fakeStats = {
      connections: { foo: 42 },
      ongoingRequests: { bar: 1337 },
      completedRequests: { baz: 666 },
      failedRequests: { qux: 667 },
      timestamp: lastFrame
    };

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    kuzzle.start(params, {dummy: true})
      .then(() => {
        return kuzzle.services.list.statsCache.init(kuzzle, {service: 'statsCache'});
      })
      .then(service => {
        return service.volatileSet(lastFrame, JSON.stringify(fakeStats), 30)
            .then(() => service.volatileSet(lastFrame + 100, JSON.stringify(fakeStats), 30));
      })
      .then(() => done())
      .catch(error => done(error));
  });

  beforeEach(function () {
    requestObject = new RequestObject({
      controller: 'admin',
      action: '',
      requestId: 'foo',
      collection: '',
      body: {}
    });

    stats = new Statistics(kuzzle);
    cacheCalled = false;
  });

  it('should initialize with a set of exposed methods', function () {
    should(stats.startRequest).be.a.Function();
    should(stats.completedRequest).be.a.Function();
    should(stats.failedRequest).be.a.Function();
    should(stats.newConnection).be.a.Function();
    should(stats.dropConnection).be.a.Function();
    should(stats.getStats).be.a.Function();
    should(stats.getLastStat).be.a.Function();
    should(stats.getAllStats).be.a.Function();
  });

  it('should register a new request when asked to', function () {
    requestObject.protocol = 'foobar';
    stats.startRequest(requestObject);
    should(stats.currentStats.ongoingRequests.foobar).not.be.undefined().and.be.exactly(1);
    stats.startRequest(requestObject);
    should(stats.currentStats.ongoingRequests.foobar).not.be.undefined().and.be.exactly(2);
  });

  it('should do nothing when startRequest is called with invalid arguments', function () {
    should(stats.startRequest()).be.false();
    should(stats.currentStats.ongoingRequests).be.empty();
    should(stats.startRequest(requestObject)).be.false();
    should(stats.currentStats.ongoingRequests).be.empty();
  });

  it('should handle completed requests', function () {
    stats.currentStats.ongoingRequests.foobar = 2;
    requestObject.protocol = 'foobar';
    stats.completedRequest(requestObject);
    should(stats.currentStats.ongoingRequests.foobar).not.be.undefined().and.be.exactly(1);
    should(stats.currentStats.completedRequests.foobar).not.be.undefined().and.be.exactly(1);
    stats.completedRequest(requestObject);
    should(stats.currentStats.ongoingRequests.foobar).not.be.undefined().and.be.exactly(0);
    should(stats.currentStats.completedRequests.foobar).not.be.undefined().and.be.exactly(2);
  });

  it('should do nothing when completedRequest is called with invalid arguments', function () {
    should(stats.completedRequest()).be.false();
    should(stats.currentStats.completedRequests).be.empty();
    should(stats.completedRequest(requestObject)).be.false();
    should(stats.currentStats.completedRequests).be.empty();
  });

  it('should handle failed requests', function () {
    stats.currentStats.ongoingRequests.foobar = 2;
    requestObject.protocol = 'foobar';
    stats.failedRequest(requestObject);
    should(stats.currentStats.ongoingRequests.foobar).not.be.undefined().and.be.exactly(1);
    should(stats.currentStats.failedRequests.foobar).not.be.undefined().and.be.exactly(1);
    stats.failedRequest(requestObject);
    should(stats.currentStats.ongoingRequests.foobar).not.be.undefined().and.be.exactly(0);
    should(stats.currentStats.failedRequests.foobar).not.be.undefined().and.be.exactly(2);
  });

  it('should do nothing when failedRequest is called with invalid arguments', function () {
    should(stats.failedRequest()).be.false();
    should(stats.currentStats.failedRequests).be.empty();
    should(stats.failedRequest(requestObject)).be.false();
    should(stats.currentStats.failedRequests).be.empty();
  });

  it('should handle new connections', function () {
    var connection = {type: 'foobar'};
    stats.newConnection(connection);
    should(stats.currentStats.connections.foobar).not.be.undefined().and.be.exactly(1);
    stats.newConnection(connection);
    should(stats.currentStats.connections.foobar).not.be.undefined().and.be.exactly(2);
  });

  it('should do nothing when newConnection is called with invalid arguments', function () {
    should(stats.newConnection()).be.false();
    should(stats.currentStats.connections).be.empty();
    should(stats.newConnection(requestObject)).be.false();
    should(stats.currentStats.connections).be.empty();
  });

  it('should be able to unregister a connection', function () {
    var connection = {type: 'foobar'};

    stats.currentStats.connections.foobar = 2;
    stats.dropConnection(connection);
    should(stats.currentStats.connections.foobar).be.exactly(1);
    stats.dropConnection(connection);
    should(stats.currentStats.connections.foobar).be.undefined();
  });

  it('should do nothing when dropConnection is called with invalid arguments', function () {
    should(stats.dropConnection()).be.false();
    should(stats.currentStats.connections).be.empty();
    should(stats.dropConnection(requestObject)).be.false();
    should(stats.currentStats.connections).be.empty();
  });

  it('should return the current frame when there is still no statistics in cache', function (done) {
    var result;

    stats.currentStats = fakeStats;
    requestObject.data.body.timestamp = lastFrame - 1000;
    result = stats.getStats(requestObject);

    should(result).be.a.Promise();

    result
      .then(response => {
        var
          serialized = response.toJson(),
          keys = Object.keys(serialized.result.statistics);

        should(serialized.error).be.null();
        should(serialized.status).be.exactly(200);
        should(serialized.result.statistics).be.an.Object();
        should(keys.length).be.exactly(1);
        should(serialized.result.statistics[keys[0]]).match(fakeStats);
        done();
      })
      .catch(error => done(error));
  });

  it('should return the current frame from the cache when statistics snapshots have been taken', function (done) {
    var result;


    stats.lastFrame = lastFrame;
    requestObject.data.body.timestamp = lastFrame - 1000;
    result = stats.getStats(requestObject);

    should(result).be.a.Promise();

    result
      .then(response => {
        var
          serialized = response.toJson(),
          keys = Object.keys(serialized.result.statistics);

        should(serialized.error).be.null();
        should(serialized.status).be.exactly(200);
        should(serialized.result.statistics).be.an.Object();
        should(keys.length).be.exactly(2);
        should(serialized.result.statistics[keys[0]]).match(fakeStats);
        done();
      })
      .catch(error => done(error));
  });

  it('should return an empty statistics because the asked date is in the future', function (done) {
    var result;


    stats.lastFrame = lastFrame;
    requestObject.data.body.timestamp = lastFrame + 1000000;
    result = stats.getStats(requestObject);

    should(result).be.a.Promise();

    result
      .then(response => {
        var
          serialized = response.toJson(),
          keys = Object.keys(serialized.result.statistics);

        should(serialized.error).be.null();
        should(serialized.status).be.exactly(200);
        should(serialized.result.statistics).be.an.Object();
        should(keys.length).be.exactly(0);
        done();
      })
      .catch(error => done(error));
  });

  it('should get the last frame from the cache when statistics snapshots have been taken', function (done) {
    var result;

    stats.lastFrame = lastFrame;
    result = stats.getLastStat(requestObject);

    should(result).be.a.Promise();

    result
      .then(response => {
        var
          serialized = response.toJson(),
          keys = Object.keys(serialized.result.statistics);

        should(serialized.error).be.null();
        should(serialized.status).be.exactly(200);
        should(serialized.result.statistics).be.an.Object();
        should(keys.length).be.exactly(1);
         should(serialized.result.statistics[keys[0]]).match(fakeStats);
        done();
      })
      .catch(error => done(error));
  });

  it('should return the current frame instead of all statistics if no cache has been initialized', function (done) {
    var result;

    stats.currentStats = fakeStats;
    result = stats.getAllStats(requestObject);

    should(result).be.a.Promise();

    result
      .then(response => {
        var
          serialized = response.toJson(),
          key = Object.keys(serialized.result.statistics);

        should(serialized.error).be.null();
        should(serialized.status).be.exactly(200);
        should(key.length).be.exactly(1);
        should(serialized.result.statistics[key[0]]).match(fakeStats);
        done();
      })
      .catch(error => done(error));
  });

  it('should return all saved statistics', function (done) {
    var result;

    stats.lastFrame = lastFrame;
    result = stats.getAllStats(requestObject);

    should(result).be.a.Promise();

    result
      .then(response => {
        var
          serialized = response.toJson(),
          key = Object.keys(serialized.result.statistics);

        should(serialized.error).be.null();
        should(serialized.status).be.exactly(200);
        should(key.length).be.exactly(2);
        should(serialized.result.statistics[key[0]]).match(fakeStats);
        should(serialized.result.statistics[key[1]]).match(fakeStats);
        done();
      })
      .catch(error => done(error));
  });

  it('should manage statistics errors', function (done) {
    stats.lastFrame = lastFrame;
    kuzzle.services.list.statsCache.volatileSet('foo', fakeStats, 10)
      .then(() => { return stats.getAllStats(requestObject); })
      .then((result) => { done(new Error('received a response instead of an error: ' + JSON.stringify(result))); })
      .catch(error => {
        try {
          should(error.status).be.exactly(500);
          should(error.error).not.be.null();
          should(error.error.message).not.be.null();
          should(error.error.message).be.a.String().and.be.exactly('Invalid time value');
          done();
        } catch (e) {
          done(e);
        }
      });
  });

  it('should write statistics frames in cache', function (done) {
    var writeStats = Statistics.__get__('writeStats');

    stats.currentStats = fakeStats;
    writeStats.call(stats);

    should(stats.currentStats.completedRequest).be.empty();
    should(stats.currentStats.failedRequests).be.empty();

    kuzzle.services.list.statsCache.get(stats.lastFrame)
      .then(result => {
        var unserialized;

        try {
          unserialized = JSON.parse(result);

        }
        catch (e) {
          done('Invalid statistics frame retrieved: ' + result + '(error: ' + e + ')');
        }

        should(unserialized).match(fakeStats);
        done();
      })
      .catch(error => done(error));
  });
});


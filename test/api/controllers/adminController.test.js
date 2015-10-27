var
  should = require('should'),
  winston = require('winston'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject');

require('should-promised');

describe('Test: admin controller', function () {
  var
    kuzzle,
    requestObject = new RequestObject({ controller: 'admin' }, { collection: 'unit-test-adminController' }, 'unit-test');

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        done();
      });
  });

  it('should activate a hook on a delete collection call', function (done) {
    this.timeout(50);

    kuzzle.once('data:deleteCollection', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.admin.deleteCollection(requestObject)
      .catch(function (error) {
        done(error);
      });
  });

  it('should activate a hook on a put mapping call', function (done) {
    this.timeout(50);

    kuzzle.once('data:putMapping', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.admin.putMapping(requestObject)
      .catch(function (error) {
        done(error);
      });
  });

  it('should return a mapping when requested', function () {
    var r = kuzzle.funnel.admin.getMapping(requestObject);

    return should(r).be.rejectedWith('No mapping for current index');
  });

  it('should activate a hook on a get mapping call', function (done) {
    this.timeout(50);

    kuzzle.once('data:getMapping', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.admin.getMapping(requestObject);
  });

  it('should trigger a hook on a getStats call', function (done) {
    this.timeout(50);

    kuzzle.once('data:getStats', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.admin.getStats(requestObject);
  });

  it('should trigger a hook on a getAllStats call', function (done) {
    this.timeout(50);

    kuzzle.once('data:getAllStats', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.admin.getAllStats(requestObject);
  });
});

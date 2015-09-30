var
  should = require('should'),
  winston = require('winston'),
  params = require('rc')('kuzzle'),
  Kuzzle = require('root-require')('lib/api/Kuzzle'),
  RequestObject = require('root-require')('lib/api/core/models/requestObject');

require('should-promised');

/*
 * Since we're sending voluntarily false requests, we expect most of these
 * calls to fail.
 */
describe('Test: write controller', function () {
  var
    kuzzle;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        done();
      });
  });

  it('should reject an empty request', function () {
    var requestObject = new RequestObject({}, {}, 'unit-test');
    delete requestObject.data.body;

    return should(kuzzle.funnel.write.create(requestObject)).be.rejected()
      .then(function () {
        return should(kuzzle.funnel.write.update(requestObject)).be.rejected();
      });
  });

  it('should emit a hook on a create data query', function (done) {
    var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

    this.timeout(50);

    kuzzle.once('data:create', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.write.create(requestObject)
      .catch(function (error) {
        done(error);
      });
  });

  it('should send notifications when creating non-persistent messages', function (done) {
    var
      mockupRooms = ['foo', 'bar'],
      requestObject = new RequestObject({body: {foo: 'bar'}, persist: false}, {}, 'unit-test');

    this.timeout(50);

    kuzzle.dsl.testFilters = function () {
      return Promise.resolve(mockupRooms);
    };

    kuzzle.notifier.notify = function (rooms) {
      try {
        should(rooms).be.exactly(mockupRooms);
        done();
      }
      catch (e) {
        done(e);
      }
    };

    kuzzle.funnel.write.create(requestObject)
      .catch(function (error) {
        done(error);
      });
  });

  it('should not send notifications right away when creating persistent messages', function (done) {
    var
      requestObject = new RequestObject({body: {foo: 'bar'}, persist: true}, {}, 'unit-test'),
      created;

    kuzzle.notifier.notify = function () {
      done(new Error('notifications incorrectly sent'));
    };

    created = kuzzle.funnel.write.create(requestObject);
    should(created).be.fulfilled();

    created.then(function () {
      done();
    });
  });

  it('should emit a hook on an update data query', function (done) {
    var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

    this.timeout(50);

    kuzzle.once('data:update', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.write.update(requestObject)
      .catch(function (error) {
        done(error);
      });
  });

  it('should emit a hook on a delete data query', function (done) {
    var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

    this.timeout(50);

    kuzzle.once('data:delete', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.write.delete(requestObject)
      .catch(function (error) {
        done(error);
      });
  });

  it('should emit a hook on a deleteByQuery data query', function (done) {
    var requestObject = new RequestObject({body: {foo: 'bar'}}, {}, 'unit-test');

    this.timeout(50);

    kuzzle.once('data:deleteByQuery', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.write.deleteByQuery(requestObject)
      .catch(function (error) {
        done(error);
      });
  });
});

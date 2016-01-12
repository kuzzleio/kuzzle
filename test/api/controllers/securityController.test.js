var
  should = require('should'),
  winston = require('winston'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');

require('should-promised');

describe('Test: security controller', function () {
  var
    kuzzle;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        // Mock
        kuzzle.repositories.role.validateAndSaveRole = role => {
          return Promise.resolve({
            _index: '%kuzzle',
            _type: 'roles',
            _id: role._id,
            created: true
          });
        };
        kuzzle.repositories.role.loadOneFromDatabase = id => {
          return Promise.resolve({
            _index: '%kuzzle',
            _type: 'roles',
            _id: id,
            _source: {}
          });
        };

        done();
      });
  });

  it('should resolve to a responseObject on a putRole call', done => {
    kuzzle.funnel.security.putRole(new RequestObject({
        body: { _id: 'test', indexes: {} }
      }))
      .then(result => {
        should(result).be.an.instanceOf(ResponseObject);
        should(result.data.body._id).be.exactly('test');
        done();
      })
      .catch(error => {
        done(error);
      });
  });

  it('should resolve to a responseObject on a getRole call', done => {
    kuzzle.funnel.security.getRole(new RequestObject({
        body: { _id: 'test' }
      }))
      .then(result => {
        should(result).be.an.instanceOf(ResponseObject);
        should(result.data.body._id).be.exactly('test');
        done();
      })
      .catch(error => {
        done(error);
      });
  });

  it('should return response with an array of roles a searchRole call', done => {
    kuzzle.funnel.security.searchRole(new RequestObject({
        body: { _id: 'test' }
      }))
      .then(result => {
        should(result).be.an.instanceOf(ResponseObject);
        should(result.data.body._id).be.exactly('test');
        done();
      })
      .catch(error => {
        done(error);
      });
  });

});

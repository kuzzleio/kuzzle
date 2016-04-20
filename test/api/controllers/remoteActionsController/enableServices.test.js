var
  rc = require('rc'),
  params = rc('kuzzle'),
  q = require('q'),
  should = require('should'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject');

describe('Test: enable services controller', function () {
  var 
    kuzzle,
    serviceEnable;

  beforeEach(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.services.list = {
          foo: {
            toggle: function (enable) {
              serviceEnable = enable;
              return q();
            }
          },
          bar: {}
        };
        kuzzle.isServer = true;

        done();
      });
  });

  it('return a rejected promise if no service is given', function () {
    var request = new RequestObject({controller: 'remoteActions', action: 'enableServices', body: {}});
    
    return should(kuzzle.remoteActionsController.actions.enableServices(kuzzle, request)).be.rejected();
  });

  it('return a rejected promise if the enable paramerter is not set', function () {
    var request = new RequestObject({controller: 'remoteActions', action: 'enableServices', body: {service: 'foo'}});
    
    return should(kuzzle.remoteActionsController.actions.enableServices(kuzzle, request)).be.rejected();
  });

  it('return a rejected promise if the service is unknown', function () {
    var request = new RequestObject({controller: 'remoteActions', action: 'enableServices', body: {service: 'baz'}});
    
    return should(kuzzle.remoteActionsController.actions.enableServices(kuzzle, request)).be.rejected();
  });

  it('return a rejected promise if the service does not support toggle', function () {
    var request = new RequestObject({controller: 'remoteActions', action: 'enableServices', body: {service: 'bar'}});
    
    return should(kuzzle.remoteActionsController.actions.enableServices(kuzzle, request)).be.rejected();
  });

  it('should toggle the service if the service exists and the enable parameter is set', function (done) {
    var request = new RequestObject({controller: 'remoteActions', action: 'enableServices', body: {service: 'foo', enable: true}});
    
    kuzzle.remoteActionsController.actions.enableServices(kuzzle, request)
      .then(() => {
        should(serviceEnable).be.true();
        done();
      })
      .catch(err => done(err));
  });
});
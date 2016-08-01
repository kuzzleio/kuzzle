var
  Promise = require('bluebird'),
  should = require('should'),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject;

describe('Test: enable services controller', () => {
  var
    kuzzle,
    serviceEnable;

  beforeEach(() => {
    kuzzle = new KuzzleServer();
    kuzzle.services.list = {
      foo: {
        toggle: enable => {
          serviceEnable = enable;
          return Promise.resolve();
        }
      },
      bar: {}
    };
  });

  it('return a rejected promise if no service is given', () => {
    var request = new RequestObject({controller: 'remoteActions', action: 'enableServices', body: {}});

    return should(kuzzle.remoteActionsController.actions.enableServices(kuzzle, request)).be.rejected();
  });

  it('return a rejected promise if the enable paramerter is not set', () => {
    var request = new RequestObject({controller: 'remoteActions', action: 'enableServices', body: {service: 'foo'}});

    return should(kuzzle.remoteActionsController.actions.enableServices(kuzzle, request)).be.rejected();
  });

  it('return a rejected promise if the service is unknown', () => {
    var request = new RequestObject({controller: 'remoteActions', action: 'enableServices', body: {service: 'baz'}});

    return should(kuzzle.remoteActionsController.actions.enableServices(kuzzle, request)).be.rejected();
  });

  it('return a rejected promise if the service does not support toggle', () => {
    var request = new RequestObject({controller: 'remoteActions', action: 'enableServices', body: {service: 'bar'}});

    return should(kuzzle.remoteActionsController.actions.enableServices(kuzzle, request)).be.rejected();
  });

  it('should toggle the service if the service exists and the enable parameter is set', () => {
    var request = new RequestObject({controller: 'remoteActions', action: 'enableServices', body: {service: 'foo', enable: true}});

    return kuzzle.remoteActionsController.actions.enableServices(kuzzle, request)
      .then(() => {
        should(serviceEnable).be.true();
      });
  });
});
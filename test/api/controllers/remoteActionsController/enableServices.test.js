var
  should = require('should'),
  sinon = require('sinon'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  sandbox = sinon.sandbox.create();

describe('Test: enable services controller', function () {
  var 
    kuzzle,
    enableServices;

  beforeEach(() => {
    kuzzle = {
      isServer: true,
      services: {
        list: {
          dummy: {},
          foo: {toggle: sandbox.spy()}
        }
      }
    };
    enableServices = require('../../../../lib/api/controllers/remoteActions/enableServices')(kuzzle);

  });

  afterEach(() => {
    sandbox.restore();
  });

  it('return a rejected promise if no service is given', () => {
    var request = new RequestObject({controller: 'remoteActions', action: 'enableServices', body: {}});
    
    return should(enableServices(request)).be.rejectedWith(BadRequestError, {message: 'Missing service name'});
  });

  it('return a rejected promise if the enable parameter is not set', () => {
    var request = new RequestObject({controller: 'remoteActions', action: 'enableServices', body: {service: 'foo'}});
    
    return should(enableServices(request)).be.rejectedWith(BadRequestError, {message: 'Missing enable/disable tag'});
  });

  it('return a rejected promise if the service is unknown', () => {
    var request = new RequestObject({controller: 'remoteActions', action: 'enableServices', body: {enable: true, service: 'baz'}});
    
    return should(enableServices(request)).be.rejectedWith(BadRequestError, {message: 'Unknown or deactivated service: baz'});
  });

  it('return a rejected promise if the service does not support toggle', () => {
    var request = new RequestObject({
      controller: 'remoteActions',
      action: 'enableServices',
      body: {
        enable: true,
        service: 'dummy'
      }
    });
    
    return should(enableServices(request)).be.rejectedWith(BadRequestError, {
      message: 'The service dummy doesn\'t support on-the-fly disabling/enabling'
    });
  });

  it('should toggle the service if the service exists and the enable parameter is set', () => {
    var request = new RequestObject({
      controller: 'remoteActions',
      action: 'enableServices',
      body: {
        service: 'foo',
        enable: true
      }
    });

    enableServices(request);

    should(kuzzle.services.list.foo.toggle).be.calledOnce();
    should(kuzzle.services.list.foo.toggle).be.calledWithExactly(true);
  });
});

var
  should = require('should'),
  captainsLog = require('captains-log'),
  RequestObject = require('root-require')('lib/api/core/models/requestObject'),
  Kuzzle = require('root-require')('lib/api/Kuzzle');

require('should-promised');

describe('Test execute function in funnel controller', function () {

  var
    kuzzle;

  beforeEach(function () {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    kuzzle.start({}, {workers: false, servers: false});
  });

  it('should reject the promise if no controller is specified', function () {
    var object = {
      action: 'create'
    };

    var requestObject = new RequestObject(object);

    return should(kuzzle.funnel.execute(requestObject, {id: 'connectionid'})).be.rejected;
  });

  it('should reject the promise if no action is specified', function () {
    var object = {
      controller: 'write'
    };

    var requestObject = new RequestObject(object);

    return should(kuzzle.funnel.execute(requestObject, {id: 'connectionid'})).be.rejected;
  });

  it('should reject the promise if the controller doesn\'t exist', function () {
    var object = {
      controller: 'toto',
      action: 'create'
    };

    var requestObject = new RequestObject(object);

    return should(kuzzle.funnel.execute(requestObject, {id: 'connectionid'})).be.rejected;
  });

  it('should reject the promise if the action doesn\'t exist', function () {
    var object = {
      controller: 'write',
      action: 'toto'
    };

    var requestObject = new RequestObject(object);

    return should(kuzzle.funnel.execute(requestObject, {id: 'connectionid'})).be.rejected;
  });

  it('should resolve the promise if everything is ok', function () {
    var object = {
      requestId: 'requestId',
      controller: 'write',
      action: 'create',
      collection: 'user',
      persist: false,
      body: {
        firstName: 'Grace'
      }
    };

    var requestObject = new RequestObject(object);

    return should(kuzzle.funnel.execute(requestObject, {id: 'connectionid'})).not.be.rejected;
  });

});
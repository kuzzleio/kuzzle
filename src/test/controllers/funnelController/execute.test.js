var
  should = require('should'),
  start = require('root-require')('lib/api/start');

require('should-promised');

describe('Test execute function in funnel controller', function () {

  var
    kuzzle;

  beforeEach(function () {
    kuzzle = {
      log: {
        debug: function() {},
        silly: function() {},
        error: function() {}
      },
      start: start
    };

    kuzzle.start({}, {workers: false, servers: false});
  });

  it('should reject an error when the object doesn\'t contain the controller', function () {
    var object = {
      action: 'create'
    };

    return should(kuzzle.funnel.execute(object, {id: 'connectionid'})).be.rejected;
  });

  it('should reject an error when the object doesn\'t contain the action', function () {
    var object = {
      controller: 'write'
    };

    return should(kuzzle.funnel.execute(object, {id: 'connectionid'})).be.rejected;
  });

  it('should reject an error when the controller doesn\'t exist', function () {
    var object = {
      controller: 'toto',
      action: 'create'
    };

    return should(kuzzle.funnel.execute(object, {id: 'connectionid'})).be.rejected;
  });

  it('should reject an error when the action doesn\'t exist', function () {
    var object = {
      controller: 'write',
      action: 'toto'
    };

    return should(kuzzle.funnel.execute(object, {id: 'connectionid'})).be.rejected;
  });

  it('should resolve something when everything is ok', function () {
    var object = {
      requestId: 'requestId',
      controller: 'write',
      action: 'create',
      collection: 'user',
      content: {
        firstName: 'Grace'
      }
    };

    return should(kuzzle.funnel.execute(object, {id: 'connectionid'})).not.be.rejected;
  });

});
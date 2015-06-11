var
  should = require('should'),
  captainsLog = require('captains-log'),
  Kuzzle = require('root-require')('lib/api/Kuzzle');

describe('Test service initialization function', function () {

  var
    kuzzle;

  beforeEach(function () {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    kuzzle.start({}, {workers: false, servers: false});
  });

  it('should build a broker service', function () {
    should(kuzzle.services.list.broker).be.an.Object;
    should(kuzzle.services.list.broker).not.be.empty;
  });

  it('should build a readEngine service with correct methods', function () {
    should(kuzzle.services.list.readEngine).be.an.Object;
    should(kuzzle.services.list.readEngine.search).be.an.Function;
    should(kuzzle.services.list.readEngine.get).be.an.Function;
  });

  it('should build a writeEngine service with correct methods', function () {
    should(kuzzle.services.list.readEngine).be.an.Object;
    should(kuzzle.services.list.readEngine.create).be.an.Function;
    should(kuzzle.services.list.readEngine.update).be.an.Function;
    should(kuzzle.services.list.readEngine.deleteByQuery).be.an.Function;
    should(kuzzle.services.list.readEngine.deleteCollection).be.an.Function;
    should(kuzzle.services.list.readEngine.import).be.an.Function;
  });
});
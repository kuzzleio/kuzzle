var
  should = require('should'),
  captainsLog = require('captains-log'),
  params = require('rc')('kuzzle'),
  Kuzzle = require('root-require')('lib/api/Kuzzle');

describe('Testing: Profiling service', function () {
  var
    kuzzle;
  /*
  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        done();
      });
  });

  it('should not add hooks and not be enabled on running', function () {
    should(kuzzle.services.list.profiling.isEnabled).be.false();
    should(kuzzle.services.list.profiling.hooksAlreadyAdded).be.false();
  });

  it('should add hooks and be enabled when toggle is called', function () {
    kuzzle.services.list.profiling.toggle(true);

    should(kuzzle.services.list.profiling.isEnabled).be.true();
    should(kuzzle.services.list.profiling.hooksAlreadyAdded).be.true();
  });

  it('should be not enabled but already initialized on disabled', function () {
    kuzzle.services.list.profiling.toggle(false);

    should(kuzzle.services.list.profiling.isEnabled).be.false();
    should(kuzzle.services.list.profiling.hooksAlreadyAdded).be.true();
  });
*/
});

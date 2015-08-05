var
  should = require('should'),
  captainsLog = require('captains-log'),
  Kuzzle = require('root-require')('lib/api/Kuzzle');

describe('Testing: Profiling service', function () {
  var
    kuzzle;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    kuzzle.start({}, {dummy: true})
      .then(function () {
        done();
      });
  });

  it('should not add hooks and not be enabled on running', function () {
    should(kuzzle.services.list.profiling.isEnabled).be.false();
  });

  it('should add hooks and be enabled when toggle is called', function () {

  });


});

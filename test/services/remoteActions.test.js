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

  it('should has init function and actions object', function () {
    should(kuzzle.services.list.remoteActions.init).be.Function();
    should(kuzzle.services.list.remoteActions.actions).not.empty().Object();
  });

});

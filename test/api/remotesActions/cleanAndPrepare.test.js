var
  rc = require('rc'),
  params = rc('kuzzle'),
  q = require('q'),
  should = require('should'),
  cleanAndPrepare = require.main.require('lib/api/remoteActions/cleanAndPrepare');


describe('Test: CleanAndPrepare remote action caller', function () {
  var 
    processExit,
    exitStatus = -1;
  
  before(function () {
    processExit = process.exit;
    process.exit = function (status) {
      exitStatus = status;
    }
  });

  after(function () {
    process.exit = processExit;
  })

  it('should prepare the data properly', function (done) {
    var
      params = {
        fixtures: 'fixtures.json',
        mappings: 'mappings.json'
      },
      data = cleanAndPrepare.prepareData(params);

    should(data.fixtures).be.eql(params.fixtures);
    should(data.mappings).be.eql(params.mappings);
    done();
  });

  it('should exit with status 1 if an error occurs', function (done) {
    var response = cleanAndPrepare.onListenCB({error: 'error!'});
    should (exitStatus).be.eql(1);
    done();
  });

  it('should exit with status 0 if everything ok', function (done) {
    var response = cleanAndPrepare.onListenCB({});
    should (exitStatus).be.eql(0);
    done();
  });

  it('should the module have all it need', function (done) {
    should(cleanAndPrepare.prepareData).be.a.Function();
    should(cleanAndPrepare.onListenCB).be.a.Function();
    should(cleanAndPrepare.timeOutCB).be.a.Function();
    should(cleanAndPrepare.isPidMandatory).be.a.Boolean();
    done();
  });
});


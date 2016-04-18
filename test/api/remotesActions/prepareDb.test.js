var
  rc = require('rc'),
  params = rc('kuzzle'),
  q = require('q'),
  should = require('should'),
  prepareDb = require.main.require('lib/api/remoteActions/prepareDb');


describe('Test: prepareDb remote action caller', function () {
  var 
    processExit,
    exitStatus = -1;
  
  before(function () {
    processExit = process.exit;
    process.exit = function (status) {
      exitStatus = status;
    };
  });

  after(function () {
    process.exit = processExit;
  });

  it('should prepare the data properly', function (done) {
    var
      params = {
        fixtures: 'fixtures.json',
        mappings: 'mappings.json'
      },
      data = prepareDb.prepareData(params);

    should(data.fixtures).be.eql(params.fixtures);
    should(data.mappings).be.eql(params.mappings);
    done();
  });

  it('should exit with status 1 if an error occurs', function (done) {
    var response = prepareDb.onListenCB({error: 'error!'});
    should (exitStatus).be.eql(1);
    done();
  });

  it('should exit with status 0 if everything ok', function (done) {
    var response = prepareDb.onListenCB({data: {body: {isWorker: false}}});
    should (exitStatus).be.eql(0);
    done();
  });

  it('should exit with status 0 if everything ok even if we are in a worker', function (done) {
    var response = prepareDb.onListenCB({data: {body: {isWorker: true}}});
    should (exitStatus).be.eql(0);
    done();
  });

  it('should the module have all it need', function (done) {
    should(prepareDb.prepareData).be.a.Function();
    should(prepareDb.onListenCB).be.a.Function();
    should(prepareDb.timeOutCB).be.a.Function();
    should(prepareDb.isPidMandatory).be.a.Boolean();
    done();
  });  
});


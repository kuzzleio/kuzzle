var
  rc = require('rc'),
  q = require('q'),
  should = require('should'),
  rewire = require('rewire'),
  cleanDb = rewire('../../../lib/api/remoteActions/cleanDb');


describe('Test: cleanDb remote action caller', function () {
  var 
    processExit,
    exitStatus = -1;
  
  before(function () {
    processExit = process.exit;
    process.exit = function (status) {
      exitStatus = status;
    };
    cleanDb.__set__('console', {
      log: function () {},
      error: function () {}
    });
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
      data = cleanDb.prepareData(params);

    should(Object.keys(data).length).be.eql(0);
    done();
  });

  it('should exit with status 1 if an error occurs', function (done) {
    var response = cleanDb.onListenCB({error: 'error!'});
    should (exitStatus).be.eql(1);
    done();
  });

  it('should exit with status 0 if everything ok', function (done) {
    var response = cleanDb.onListenCB({});
    should (exitStatus).be.eql(0);
    done();
  });

  it('should the module have all it need', function (done) {
    should(cleanDb.prepareData).be.a.Function();
    should(cleanDb.onListenCB).be.a.Function();
    should(cleanDb.timeOutCB).be.a.Function();
    should(cleanDb.isPidMandatory).be.a.Boolean();
    done();
  });  
});


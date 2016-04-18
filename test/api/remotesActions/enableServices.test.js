var
  rc = require('rc'),
  params = rc('kuzzle'),
  q = require('q'),
  should = require('should'),
  rewire = require('rewire'),
  enableServices = rewire('../../../lib/api/remoteActions/enableServices');


describe('Test: enableServices remote action caller', function () {
  var 
    processExit,
    exitStatus = -1;
  
  before(function () {
    processExit = process.exit;
    process.exit = function (status) {
      exitStatus = status;
    };
    enableServices.__set__('console', {
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
        _: ['foo', 'bar', 'baz']
      },
      args = {
        enable: true
      },
      data = enableServices.prepareData(params, args);

    should(data.service).be.eql('baz');
    should(data.enable).be.true();
    done();
  });

  it('should exit with status 1 if an error occurs', function (done) {
    var response = enableServices.onListenCB({error: {message: 'error!'}});
    should (exitStatus).be.eql(1);
    done();
  });

  it('should exit with status 0 if everything ok', function (done) {
    var response = enableServices.onListenCB({data: {body: {}}});
    should (exitStatus).be.eql(0);
    done();
  });

  it('should the module have all it need', function (done) {
    should(enableServices.prepareData).be.a.Function();
    should(enableServices.onListenCB).be.a.Function();
    should(enableServices.timeOutCB).be.a.Function();
    should(enableServices.isPidMandatory).be.a.Boolean();
    done();
  });  
});


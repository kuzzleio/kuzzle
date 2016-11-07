var
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  Action = rewire('../../../lib/api/cli/action'),
  sandbox = sinon.sandbox.create();

describe('Tests: cliController action client', () => {
  afterEach(() => {
    sandbox.restore();
  });

  describe('#constructor', () => {

    it('should populate proper properties', () => {
      var action = new Action();

      should(action.deferred.resolve).be.a.Function();
      should(action.deferred.reject).be.a.Function();
      should(action.deferred.promise).be.a.Promise();
      should(action.timeoutTimer).be.null();
    });

    it('should override methods with given ones', () => {
      var
        prepareData = () => true,
        onListenCB = () => true,
        onError = () => true,
        onSuccess = () => true,
        timeOutCB = () => true,
        action = new Action({
          prepareData,
          onListenCB,
          onError,
          onSuccess,
          timeOutCB
        });

      should(action.prepareData).be.exactly(prepareData);
      should(action.onListenCB).be.exactly(onListenCB);
      should(action.onError).be.exactly(onError);
      should(action.timeOutCB).be.exactly(timeOutCB);
    });

  });

  describe('#prepareDate', () => {
    var action = new Action();

    it('should return imput', () => {
      var data = {foo: 'bar'};

      should(action.prepareData(data)).be.exactly(data);
    });

  });

  describe('#onError', () => {

    it('should reject the deferred promise', () => {
      var
        action = new Action(),
        error = new Error('test');

      sandbox.stub(action.deferred, 'reject');

      action.onError(error);
      should(action.deferred.reject).be.calledOnce();
      should(action.deferred.reject).be.calledWithExactly(error);
    });

  });

  describe('#onSuccess', () => {

    it('should resolve the deferred promise', () => {
      var
        action = new Action(),
        data = {foo: 'bar'};

      sandbox.stub(action.deferred, 'resolve');

      action.onSuccess(data);

      should(action.deferred.resolve).be.calledOnce();
      should(action.deferred.resolve).be.calledWithExactly(data);
    });

  });

  describe('#onListenCB', () => {
    var action, reset;

    beforeEach(() => {
      reset = Action.__set__({
        clearTimeout: sinon.spy()
      });
      action = new Action();

      sandbox.stub(action, 'onSuccess');
      sandbox.stub(action, 'onError');
    });

    afterEach(() => {
      reset();
    });

    it('should resolve the deferred promise if some valid input was received', () => {
      var data = {foo: 'bar'};

      action.onListenCB(data);

      should(action.onSuccess).be.calledOnce();
      should(action.onSuccess).be.calledWithExactly(data);
      should(Action.__get__('clearTimeout')).be.calledOnce();
    });

    it('should reject the deferred promise if some error was received', () => {
      var
        error = {foo: 'bar'},
        data = {error};

      action.onListenCB(data);

      should(action.onError).be.calledOnce();
      should(action.onError).be.calledWithExactly(error);
      should(Action.__get__('clearTimeout')).be.calledOnce();
    });

  });

  describe('#initTimeout', () => {

    it('should start the timer', () => {
      return Action.__with__({
        setTimeout: sinon.spy(),
        'Function.prototype.bind': sinon.spy(Function.prototype.bind)
      })(() => {
        var
          action = new Action(),
          bindSpy = Action.__get__('Function.prototype.bind'),
          setTimeoutSpy = Action.__get__('setTimeout');

        action.initTimeout();

        // Function.prototype.bind returns a *new* function
        should(bindSpy)
          .be.calledTwice();
        should(bindSpy.thisValues[1])
          .be.exactly(action.timeOutCB);

        should(setTimeoutSpy)
          .be.calledOnce()
          .be.calledWith(bindSpy.returnValues[1]);
      });
    });

  });

  describe('#timeOutCB', () => {

    it('should display an error message and exit', () => {
      return Action.__with__({
        console: {
          log: sinon.spy()
        },
        process: {
          exit: sinon.spy()
        }
      })(() => {
        var
          action = new Action(),
          consoleSpy = Action.__get__('console.log'),
          processSpy = Action.__get__('process.exit');

        action.timeOutCB();

        should(consoleSpy).be.calledOnce();
        should(consoleSpy).be.calledWithExactly('Unable to connect to Kuzzle');
        should(processSpy).be.calledOnce();
        should(processSpy).be.calledWithExactly(1);
      });
    });

  });

});

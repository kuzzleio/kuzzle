var
  should = require('should'),
  rewire = require('rewire'),
  captainsLog = require('captains-log'),
  params = require('rc')('kuzzle'),
  Kuzzle = require('root-require')('lib/api/Kuzzle'),
  RemoteActions = rewire('../../lib/services/remoteActions');

describe('Testing: Remote Actions service', function () {
  var
    kuzzle,
    remoteActions,
    remoteActionsCallback = RemoteActions.__get__('onListenCB'),
    room,
    addedMessage;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    return kuzzle.start(params, {dummy: true})
      .then(function () {
        remoteActions = new RemoteActions(kuzzle);

        kuzzle.services.list.broker.add = function (destination, message) {
          room = destination;
          addedMessage = message;
        };

        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  beforeEach(function () {
    room = '';
    addedMessage = {};
  });

  it('should have init function', function () {
    should(kuzzle.services.list.remoteActions.init).be.Function();
  });

  it('should register to the remote actions queues when initializing', function () {
    var
      expectedQueues = [
        kuzzle.config.queues.remoteActionQueue + '-' + process.pid,
        kuzzle.config.queues.remoteActionQueue
      ],
      registeredQueues = [];

    kuzzle.services.list.broker.listen = function (queue) {
      registeredQueues.push(queue);
    };

    remoteActions.init();

    should(registeredQueues.length).be.exactly(2);
    should(registeredQueues.sort()).match(expectedQueues.sort());
  });

  it('should ignore actions sent without an id', function () {
    var
      ret;

    ret = remoteActionsCallback({service: 'foobar'});

    should(ret).be.false();
    should(room).be.exactly('');
  });

  it('should reject the action if no service name is provided', function () {
    remoteActionsCallback.call(remoteActions, {id: 'foo'});
    should(room).be.exactly('foo');
    should(addedMessage).be.an.Object().and.not.be.empty();
    should(addedMessage.error).not.be.undefined().and.be.a.String();
    should(addedMessage.error).be.exactly('Missing service name');
  });

  it('should reject the action if no enable flag is provided', function () {
    remoteActionsCallback.call(remoteActions, {id: 'foo', service: 'bar'});
    should(room).be.exactly('foo');
    should(addedMessage).be.an.Object().and.not.be.empty();
    should(addedMessage.error).not.be.undefined().and.be.a.String();
    should(addedMessage.error).be.exactly('Missing enable/disable tag');
  });

  it('should reject the action if the provided service name isn\'t in the service list', function () {
    remoteActionsCallback.call(remoteActions, {id: 'foo', service: 'bar', enable: true});
    should(room).be.exactly('foo');
    should(addedMessage).be.an.Object().and.not.be.empty();
    should(addedMessage.error).not.be.undefined().and.be.a.String();
    should(addedMessage.error).be.exactly('Unknown or deactivated service: bar');
  });

  it('should reject the action if the target service is not togglable', function () {
    kuzzle.services.list.mockupService = {};

    remoteActionsCallback.call(remoteActions, {id: 'foo', service: 'mockupService', enable: true});
    should(room).be.exactly('foo');
    should(addedMessage).be.an.Object().and.not.be.empty();
    should(addedMessage.error).not.be.undefined().and.be.a.String();
    should(addedMessage.error).be.exactly('The service mockupService doesn\'t support on-the-fly disabling/enabling');
  });

  it('should forward to kuzzle a success result if toggling the service succeed', function (done) {
    var enabled = false;

    kuzzle.services.list.mockupService = {
      toggle: function (flag) {
        enabled = flag;
        return Promise.resolve('Enabled: ' + flag.toString());
      }
    };

    remoteActionsCallback.call(remoteActions, {id: 'foo', service: 'mockupService', enable: true});
    setTimeout(function () {
      try {
        should(room).be.exactly('foo');
        should(addedMessage).be.an.Object().and.not.be.empty();
        should(addedMessage.error).be.undefined();
        should(addedMessage.result).not.be.undefined().and.be.exactly('Enabled: true');
      }
      catch (error) {
        done(error);
      }

      remoteActionsCallback.call(remoteActions, {id: 'bar', service: 'mockupService', enable: false});
      setTimeout(function () {
        try {
          should(room).be.exactly('bar');
          should(addedMessage).be.an.Object().and.not.be.empty();
          should(addedMessage.error).be.undefined();
          should(addedMessage.result).not.be.undefined().and.be.exactly('Enabled: false');
          done();
        }
        catch (error) {
          done(error);
        }
      }, 20);
    }, 20);
  });

  it('should forward to kuzzle a failed result if togging the service fails', function (done) {
    kuzzle.services.list.mockupService = {
      toggle: function () {
        return Promise.reject(new Error('rejected'));
      }
    };

    remoteActionsCallback.call(remoteActions, {id: 'foo', service: 'mockupService', enable: true});
    setTimeout(function () {
      try {
        should(room).be.exactly('foo');
        should(addedMessage).be.an.Object().and.not.be.empty();
        should(addedMessage.error).not.be.undefined().and.be.a.String();
        should(addedMessage.error).be.exactly('rejected');
        done();
      }
      catch (error) {
        done(error);
      }
    }, 20);
  });
});

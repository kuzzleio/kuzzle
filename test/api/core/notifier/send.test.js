/**
 * The send() function is the main function of the notifier core component.
 * Though it itsn't exposed, this is the exit point for any and each notifier invocation, as it is in charge
 * of sending the notifications, either to a particular connection, or as a broadcast message
 */
var
  should = require('should'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  Notifier = rewire('../../../../lib/api/core/notifier');

describe('Test: notifier.send', () => {
  var
    kuzzle,
    channel = 'stubChannel',
    requestObject = new RequestObject({
      controller: 'write',
      action: 'update',
      requestId: 'foo',
      collection: 'bar',
      _id: 'Sir Isaac Newton is the deadliest son-of-a-bitch in space',
      body: { foo: 'bar' }
    }),
    notification = {
      action: 'update',
      _id: requestObject.data._id,
      _source: requestObject.data.body,
      scope: 'in',
      state: 'done'
    };

  before(function () {
    kuzzle = new KuzzleServer();
  });

  beforeEach(function () {
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(() => {
        sandbox.stub(kuzzle.hotelClerk, 'getChannels', () => [channel]);
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should emit a proxy:broadcast hook on channels to be notified', function (done) {
    var
      room = 'foo';

    this.timeout(50);

    kuzzle.once('proxy:broadcast', (data) => {
      should(data).be.an.Object();
      should(data.channel).be.eql(channel);
      should(data.payload).be.an.Object();
      should(data.payload.action).be.eql(notification.action);
      should(data.payload.result._id).be.eql(notification._id);
      should(data.payload.result._source).be.eql(notification._source);
      should(data.payload.state).be.eql(notification.state);
      should(data.payload.scope).be.eql(notification.scope);
      done();
    });

    (Notifier.__get__('send')).call(kuzzle, room, requestObject, notification);
  });

  it('should emit a proxy:notify hook when a connection ID is provided', function (done) {
    var
      room = 'foo',
      anotherChannel = 'stubChannel',
      connectionId = 'Brian Kernighan';

    this.timeout(50);

    kuzzle.once('proxy:notify', (data) => {
      should(data).be.an.Object();
      should(data.channel).be.eql(anotherChannel);
      should(data.payload).be.an.Object();
      should(data.payload.action).be.eql(notification.action);
      should(data.payload.result._id).be.eql(notification._id);
      should(data.payload.result._source).be.eql(notification._source);
      should(data.payload.state).be.eql(notification.state);
      should(data.payload.scope).be.eql(notification.scope);
      done();
    });

    (Notifier.__get__('send')).call(kuzzle, room, requestObject, notification, connectionId);
  });
});

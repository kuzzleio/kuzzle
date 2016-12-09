/**
 * This class describes the response sent to realtime requests
 */
var
  should = require('should'),
  Request = require('kuzzle-common-objects').Request,
  NotificationObject = require('../../../../lib/api/core/models/notificationObject');

describe('Test: NotificationObject', () => {
  var
    roomId = 'fakeroomid',
    request = new Request({
      controller: 'realtime',
      action: 'count',
      index: 'fakeIndex',
      collection: 'fakecollection',
      body: {foo: 'bar'}
    }, {
      protocol: 'fakeprotocol'
    });

  it('should have a toJSon prototype function', () => {
    var response = new NotificationObject(roomId, request);

    should(response.toJson).not.be.undefined().and.be.a.Function();
  });

  it('should return a normalized count response', () => {
    var
      notificationObject = new NotificationObject(roomId, request, {count: 42}),
      response = notificationObject.toJson();

    should(response.error).be.null();
    should(response.status).be.a.Number().and.be.eql(200);
    should(response.action).be.exactly(request.input.action);
    should(response.controller).be.exactly(request.input.controller);
    should(response.metadata).match(request.input.metadata);
    should(response.protocol).be.exactly(request.context.protocol);
    should(response.requestId).be.exactly(request.id);
    should(response.timestamp).be.exactly(request.timestamp);
    should(response.index).be.exactly(request.input.resource.index);
    should(response.collection).be.exactly(request.input.resource.collection);

    should(response.result).not.be.null().and.be.an.Object();
    should(response.result.count).be.exactly(42);
  });

  it('should return a normalized channel response', () => {
    var
      notificationObject = new NotificationObject(roomId, request, {channel: 'foobar'}),
      response = notificationObject.toJson();

    should(response.error).be.null();
    should(response.status).be.a.Number().and.be.eql(200);
    should(response.action).be.exactly(request.input.action);
    should(response.controller).be.exactly(request.input.controller);
    should(response.metadata).match(request.input.metadata);
    should(response.protocol).be.exactly(request.context.protocol);
    should(response.requestId).be.exactly(request.id);
    should(response.timestamp).be.exactly(request.timestamp);
    should(response.index).be.exactly(request.input.resource.index);
    should(response.collection).be.exactly(request.input.resource.collection);

    should(response.result).not.be.null().and.be.an.Object();
    should(response.result.channel).be.exactly('foobar');
  });

  it('should return a normalized subscription response', () => {
    var
      notificationObject = new NotificationObject(roomId, request),
      response = notificationObject.toJson();

    should(response.error).be.null();
    should(response.status).be.a.Number().and.be.eql(200);
    should(response.action).be.exactly(request.input.action);
    should(response.controller).be.exactly(request.input.controller);
    should(response.metadata).match(request.input.metadata);
    should(response.protocol).be.exactly(request.context.protocol);
    should(response.requestId).be.exactly(request.id);
    should(response.timestamp).be.exactly(request.timestamp);
    should(response.index).be.exactly(request.input.resource.index);
    should(response.collection).be.exactly(request.input.resource.collection);

    should(response.result).be.undefined();
  });
});

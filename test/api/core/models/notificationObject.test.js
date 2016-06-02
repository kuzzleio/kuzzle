/**
 * This class describes the response sent to realtime requests
 */
var
  should = require('should'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  NotificationObject = require.main.require('lib/api/core/models/notificationObject');

describe('Test: NotificationObject', function () {
  var
    roomId = 'fakeroomid',
    requestObject = new RequestObject({
      controller: 'subscribe',
      action: 'count',
      index: 'fakeIndex',
      collection: 'fakecollection',
      protocol: 'fakeprotocol',
      body: { foo: 'bar' }
    });

  it('should have a toJSon prototype function', function () {
    var response = new NotificationObject(roomId, requestObject);

    should(response.toJson).not.be.undefined().and.be.a.Function();
  });

  it('should return a normalized count response', function () {
    var
      notificationObject = new NotificationObject(roomId, requestObject, {count: 42}),
      response = notificationObject.toJson();

    should(response.error).be.null();
    should(response.status).be.a.Number().and.be.eql(200);
    should(response.action).be.exactly(requestObject.action);
    should(response.controller).be.exactly(requestObject.controller);
    should(response.metadata).match(requestObject.metadata);
    should(response.protocol).be.exactly(requestObject.protocol);
    should(response.requestId).be.exactly(requestObject.requestId);
    should(response.timestamp).be.exactly(requestObject.timestamp);
    should(response.index).be.exactly(requestObject.index);
    should(response.collection).be.exactly(requestObject.collection);

    should(response.result).not.be.null().and.be.an.Object();
    should(response.result.count).be.exactly(42);
  });

  it('should return a normalized channel response', function () {
    var
      notificationObject = new NotificationObject(roomId, requestObject, {channel: 'foobar'}),
      response = notificationObject.toJson();

    should(response.error).be.null();
    should(response.status).be.a.Number().and.be.eql(200);
    should(response.action).be.exactly(requestObject.action);
    should(response.controller).be.exactly(requestObject.controller);
    should(response.metadata).match(requestObject.metadata);
    should(response.protocol).be.exactly(requestObject.protocol);
    should(response.requestId).be.exactly(requestObject.requestId);
    should(response.timestamp).be.exactly(requestObject.timestamp);
    should(response.index).be.exactly(requestObject.index);
    should(response.collection).be.exactly(requestObject.collection);

    should(response.result).not.be.null().and.be.an.Object();
    should(response.result.channel).be.exactly('foobar');
  });

  it('should return a normalized subscription response', function () {
    var
      notificationObject = new NotificationObject(roomId, requestObject),
      response = notificationObject.toJson();

    should(response.error).be.null();
    should(response.status).be.a.Number().and.be.eql(200);
    should(response.action).be.exactly(requestObject.action);
    should(response.controller).be.exactly(requestObject.controller);
    should(response.metadata).match(requestObject.metadata);
    should(response.protocol).be.exactly(requestObject.protocol);
    should(response.requestId).be.exactly(requestObject.requestId);
    should(response.timestamp).be.exactly(requestObject.timestamp);
    should(response.index).be.exactly(requestObject.index);
    should(response.collection).be.exactly(requestObject.collection);

    should(response.result).be.undefined();
  });
});

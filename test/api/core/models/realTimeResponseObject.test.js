/**
 * This class describes the response sent to realtime requests
 */
var
  should = require('should'),
  rewire = require('rewire'),
  uuid = require('node-uuid'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  RTResponseObject = require.main.require('lib/api/core/models/realTimeResponseObject');


describe('Test: realTimeResponseObject', function () {
  var
    roomId = 'fakeroomid',
    requestObject = new RequestObject({
      controller: 'subscribe',
      action: 'count',
      collection: 'fakecollection',
      protocol: 'fakeprotocol',
      body: { foo: 'bar' }
    });

  it('should have a toJSon prototype function', function () {
    var response = new RTResponseObject(roomId, requestObject);

    should(response.toJson).not.be.undefined().and.be.a.Function();
  });

  it('should return a normalized count response', function () {
    var
      responseObject = new RTResponseObject(roomId, requestObject, {count: 42}),
      response = responseObject.toJson();

    should(response.error).be.null();
    should(response.status).be.a.Number().and.be.eql(200);
    should(response.result).not.be.null().and.be.an.Object();
    should(response.result.action).be.exactly(requestObject.action);
    should(response.result.controller).be.exactly(requestObject.controller);
    should(response.result.metadata).match(requestObject.metadata);
    should(response.result.protocol).be.exactly(requestObject.protocol);
    should(response.result.requestId).be.exactly(requestObject.requestId);
    should(response.result.timestamp).be.exactly(requestObject.timestamp);
    should(response.result.count).be.exactly(42);
  });

  it('should return a normalized channel response', function () {
    var
      responseObject = new RTResponseObject(roomId, requestObject, {channel: 'foobar'}),
      response = responseObject.toJson();

    should(response.error).be.null();
    should(response.status).be.a.Number().and.be.eql(200);
    should(response.result).not.be.null().and.be.an.Object();
    should(response.result.action).be.exactly(requestObject.action);
    should(response.result.controller).be.exactly(requestObject.controller);
    should(response.result.metadata).match(requestObject.metadata);
    should(response.result.protocol).be.exactly(requestObject.protocol);
    should(response.result.requestId).be.exactly(requestObject.requestId);
    should(response.result.timestamp).be.exactly(requestObject.timestamp);
    should(response.result.channel).be.exactly('foobar');
  });

  it('should return a normalized subscription response', function () {
    var
      responseObject = new RTResponseObject(roomId, requestObject),
      response = responseObject.toJson();

    should(response.error).be.null();
    should(response.result).not.be.null();
    should(response.error).be.null();
    should(response.status).be.a.Number().and.be.eql(200);
    should(response.result).not.be.null().and.be.an.Object();
    should(response.result.action).be.exactly(requestObject.action);
    should(response.result.controller).be.exactly(requestObject.controller);
    should(response.result.metadata).match(requestObject.metadata);
    should(response.result.protocol).be.exactly(requestObject.protocol);
    should(response.result.requestId).be.exactly(requestObject.requestId);
    should(response.result.timestamp).be.exactly(requestObject.timestamp);
    should(response.result.count).be.undefined();
  });
});

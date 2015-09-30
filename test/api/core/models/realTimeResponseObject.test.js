/**
 * This class describes the response sent to realtime requests
 */
var
  should = require('should'),
  winston = require('winston'),
  rewire = require('rewire'),
  uuid = require('node-uuid'),
  RequestObject = require('root-require')('lib/api/core/models/requestObject'),
  RTResponseObject = require('root-require')('lib/api/core/models/realTimeResponseObject');


describe('Test: realTimeResponseObject', function () {
  var
    roomId = 'fakeroomid',
    requestObject = new RequestObject({
      controller: 'write',
      action: 'update',
      requestId: 'fakerequestid',
      collection: 'fakecollection',
      body: { foo: 'bar' }
    });

  it('should have a toJSon prototype function', function () {
    var response = new RTResponseObject(roomId, requestObject);

    should(response.toJson).not.be.undefined().and.be.a.Function();
  });

  it('should return a normalized count response', function () {
    var
      responseObject = new RTResponseObject(roomId, requestObject, 42),
      response = responseObject.toJson();

    should(response.error).be.null();
    should(response.result).not.be.null().and.be.exactly(42);
  });

  it('should return a normalized subscription response', function () {
    var
      responseObject = new RTResponseObject(roomId, requestObject),
      response = responseObject.toJson();

    should(response.error).be.null();
    should(response.result).not.be.null();
    should(response.result.roomId).not.be.undefined().and.be.exactly(roomId);
    should(response.result.roomName).not.be.undefined().and.be.exactly(requestObject.requestId);
  });
});

/**
 * This class describes the normalized requests made by clients of Kuzzle
 */
var
  should = require('should'),
  winston = require('winston'),
  rewire = require('rewire'),
  uuid = require('node-uuid'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError');

require('should-promised');

describe('Test: requestObject', function () {
  var
    protocol = 'foobar',
    request;

  beforeEach(function () {
    request = {
      action: 'fakeAction',
      controller: 'fakeController',
      collection: 'fakeCollection',
      protocol: protocol,
      requestId: 'fakerequestId',
      body: { _id: 'fakeid', foo: 'bar' },
      state: 'fakeState',
      scope: 'fakeScope',
      users: 'fakeUsers'
    };
  });

  it('should have required prototypes defined', function () {
    var requestObject = new RequestObject({}, {}, '');

    should(requestObject.checkInformation).not.be.undefined().and.be.a.Function();
    should(requestObject.isValid).not.be.undefined().and.be.a.Function();
  });

  it('should initialize a valid request object out of a basic request', function () {
    var
      timestampStart = (new Date()).getTime(),
      timestampEnd,
      requestObject = new RequestObject(request, {}, protocol);

    timestampEnd = (new Date()).getTime();

    should(requestObject.data).not.be.undefined();
    should(requestObject.data._id).not.be.undefined().and.be.exactly(request.body._id);
    should(requestObject.data.body).not.be.undefined().and.match(request.body);
    should(requestObject.protocol).be.exactly(protocol);
    should(requestObject.controller).be.exactly(request.controller);
    should(requestObject.collection).be.exactly(request.collection);
    should(requestObject.controller).be.exactly(request.controller);
    should(requestObject.state).be.exactly(request.state.toLowerCase());
    should(requestObject.scope).be.exactly(request.scope.toLowerCase());
    should(requestObject.users).be.exactly(request.users.toLowerCase());
    should(requestObject.requestId).be.exactly(request.requestId);
    should(requestObject.timestamp).be.a.Number().and.be.within(timestampStart, timestampEnd);
  });

  it('should ignore the query member if a body is defined', function () {
    var requestObject;

    request.query = { foo: 'bar' };
    requestObject = new RequestObject(request, { query: {bar: 'foo'} }, protocol);

    should(requestObject.query).be.undefined();
  });

  it('should replace the entire data structure by the request itself if a query member is provided in the request', function () {
    var
      query = { foo: 'bar' },
      requestObject;

    request.query = query;
    delete request.body;
    requestObject = new RequestObject(request, { query: {bar: 'foo' }}, protocol);

    should(requestObject.data).match(request);
  });

  it('should replace the entire data structure by the additional data if it contains a query member', function () {
    var
      additionalData = { query: {bar: 'foo' }},
      requestObject;

    delete request.body;
    requestObject = new RequestObject(request, additionalData, protocol);

    should(requestObject.data).match(additionalData);
  });

  it('should initialize the data.body structure with the additional data argument if none of the previous cases matches', function () {
    var
      additionalData = { foo: 'bar'},
      requestObject;

    delete request.body;
    requestObject = new RequestObject(request, additionalData, protocol);

    should(requestObject.data.body).not.be.undefined();
    should(requestObject.data.body).match(additionalData);
  });

  it('should initialize an UUID-like requestID if none was provided', function () {
    var requestObject;

    delete request.requestId;
    requestObject = new RequestObject(request, {}, protocol);

    should(requestObject.requestId).not.be.undefined().and.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should return a promise when checkInformation is called', function () {
    var
      requestObject = new RequestObject(request, {}, ''),
      checkInformation = requestObject.checkInformation();

    should(checkInformation).be.a.Promise();
    return should(checkInformation).be.fulfilled();
  });

  it('should reject the promise if no controller has been provided', function () {
    var requestObject;

    delete request.controller;
    requestObject = new RequestObject(request, {}, '');

    return should(requestObject.checkInformation()).be.rejectedWith(BadRequestError, { message: 'No controller provided for object' });
  });
  it('should reject the promise if no action has been provided', function () {

    var requestObject;

    delete request.action;
    requestObject = new RequestObject(request, {}, '');

    return should(requestObject.checkInformation()).be.rejectedWith(BadRequestError, { message: 'No action provided for object' });
  });

  it('should return a promise when isValid is invoked', function () {
    var
      requestObject = new RequestObject(request, {}, ''),
      isValid = requestObject.isValid();

    should(isValid).be.a.Promise();
    return should(isValid).be.fulfilled();
  });

  it('should reject the promise if there is no data.body', function () {
    var requestObject;

    delete request.body;
    requestObject = new RequestObject(request, {}, '');

    return should(requestObject.isValid()).be.rejectedWith(BadRequestError, { message: 'The body can\'t be empty' });
  });

  it('should get the _id of the additional data', function () {
    var
      additionalData = { _id: 'fakeId2'},
      requestObject;

    delete request.body;
    requestObject = new RequestObject(request, additionalData, protocol);

    should(requestObject.data._id).not.be.undefined();
    should(requestObject.data._id).be.exactly('fakeId2');
  });

  it('should get the metadata from additional data', function () {
    var
      additionalData = { metadata: { foo: 'bar' }},
      requestObject = new RequestObject(request, additionalData, protocol);

    should(requestObject.metadata).not.be.undefined().and.match(additionalData.metadata);
  });

  it('should get the metadata from the request', function () {
    var requestObject;

    request.metadata = { foo: 'bar' };
    requestObject = new RequestObject(request, {}, protocol);

    should(requestObject.metadata).not.be.undefined().and.match(request.metadata);
  });

  it('should take the metadata from the additional prior to the main request object', function () {
    var
      additionalData = { metadata: { foo: 'bar' }},
      requestObject;

    request.metadata = { bar: 'foo' };
    requestObject = new RequestObject(request, additionalData, protocol);

    should(requestObject.metadata).not.be.undefined().and.match(additionalData.metadata);
  });

  it('should ignore metadata if they are not a json object', function () {
    var
      additionalData = { metadata: 'foobar'},
      requestObject;

    request.metadata = 'barfoo';
    requestObject = new RequestObject(request, additionalData, protocol);

    should(requestObject.metadata).be.an.Object().and.be.empty();
  });
});

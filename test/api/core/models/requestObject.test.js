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
      action: 'fakeaction',
      controller: 'fakecontroller',
      collection: 'fakecollection',
      persist: 'maybe',
      protocol: protocol,
      requestId: 'fakerequestId',
      body: { _id: 'fakeid', foo: 'bar' }
    };
  });

  it('should have required prototypes defined', function () {
    var requestObject = new RequestObject({}, {}, '');

    should(requestObject.checkInformation).not.be.undefined().and.be.a.Function();
    should(requestObject.isValid).not.be.undefined().and.be.a.Function();
    should(requestObject.isPersistent).not.be.undefined().and.be.a.Function();
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
    should(requestObject.persist).be.exactly(request.persist);
    should(requestObject.requestId).be.exactly(request.requestId);
    should(requestObject.timestamp).be.a.Number().and.be.within(timestampStart, timestampEnd);
  });

  it('should take the persist flag from additional data prior to the one in the main request object', function () {
    var requestObject = new RequestObject(request, { persist: false }, protocol);

    should(requestObject.persist).not.be.undefined().and.be.false();
  });

  it('should set persist to true by default', function () {
    var requestObject;

    delete request.persist;

    requestObject = new RequestObject(request, {}, protocol);

    should(requestObject.persist).not.be.undefined().and.be.true();
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

  it('should generate a MD5-hash of the body as a requestID for subscribe requests with no requestID provided', function () {
    var requestObject;

    request.controller = 'subscribe';
    delete request.requestId;
    requestObject = new RequestObject(request, {}, protocol);

    should(requestObject.requestId).not.be.undefined().and.match(/[a-fA-F0-9]{32}/);
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

  it('should be able to tell if data is persistent or not', function () {
    var requestObject = new RequestObject(request, {}, '');

    requestObject.persist = true;
    should(requestObject.isPersistent()).be.true();

    requestObject.persist = 'true';
    should(requestObject.isPersistent()).be.true();

    requestObject.persist = false;
    should(requestObject.isPersistent()).be.false();

    requestObject.persist = 'foobar';
    should(requestObject.isPersistent()).be.false();

    delete requestObject.persist;
    should(requestObject.isPersistent()).be.false();

    requestObject.persist = null;
    should(requestObject.isPersistent()).be.false();

    requestObject.persist = [];
    should(requestObject.isPersistent()).be.false();

    requestObject.persist = {};
    should(requestObject.isPersistent()).be.false();
  });
});

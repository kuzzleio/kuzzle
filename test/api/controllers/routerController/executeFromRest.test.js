/*
 * This file tests the executeFromRest function, which transmit requests and responses
 * between clients and the funnel controller
 */

var
  should = require('should'),
  winston = require('winston'),
  params = require('rc')('kuzzle'),
  Kuzzle = require('root-require')('lib/api/Kuzzle'),
  rewire = require('rewire'),
  RouterController = rewire('../../../../lib/api/controllers/routerController'),
  RequestObject = require('root-require')('lib/api/core/models/requestObject'),
  ResponseObject = require('root-require')('lib/api/core/models/responseObject');

require('should-promised');

describe('Test: routerController.executeFromRest', function () {
  var
    kuzzle,
    mockupResponse = {
      ended: false,
      statusCode: 0,
      header: {},
      response: {},
      init: function () { this.ended = false; this.statusCode = 0; this.response = {}; this.header = ''; },
      writeHead: function (status, header) { this.statusCode = status; this.header = header; },
      end: function (message) { this.ended = true; this.response = JSON.parse(message); }
    },
    executeFromRest;

    before(function (done) {
      var
        mockupFunnel = function (requestObject) {
          var forwardedObject = new ResponseObject(requestObject, {});

          if (requestObject.data.body.resolve) {
            if (requestObject.data.body.empty) {
              return Promise.resolve({});
            }
            else {
              return Promise.resolve(forwardedObject);
            }
          }
          else {
            return Promise.reject(new Error('rejected'));
          }
        },
        mockupRouterListener = {
          listener: {
            add: function () { return true; }
          }
        };

      kuzzle = new Kuzzle();
      kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});

      kuzzle.start(params, {dummy: true})
        .then(function () {
          kuzzle.funnel.execute = mockupFunnel;
          RouterController.router = mockupRouterListener;

          executeFromRest = RouterController.__get__('executeFromRest');
          done();
        });
    });

    it('should reject requests when the controller is not provided', function () {
      var params = { action: 'create', collection: 'foobar' };

      mockupResponse.init();
      executeFromRest.call(kuzzle, params, {}, mockupResponse);

      should(mockupResponse.statusCode).be.exactly(400);
      should(mockupResponse.header['Content-Type']).not.be.undefined();
      should(mockupResponse.header['Content-Type']).be.exactly('application/json');
      should(mockupResponse.response.result).be.null();
      should(mockupResponse.response.error).not.be.null();
      should(mockupResponse.response.error).be.exactly('The "controller" argument is missing');
    });

    it('should respond with a HTTP 200 message in case of success', function (done) {
      var
        params = { action: 'create', controller: 'write' },
        data = {body: {resolve: true}, params: {collection: 'foobar'}};

      mockupResponse.init();
      executeFromRest.call(kuzzle, params, data, mockupResponse);

      setTimeout(function () {
        try {
          should(mockupResponse.statusCode).be.exactly(200);
          should(mockupResponse.header['Content-Type']).not.be.undefined();
          should(mockupResponse.header['Content-Type']).be.exactly('application/json');
          should(mockupResponse.response.error).be.null();
          should(mockupResponse.response.result).be.not.null();
          should(mockupResponse.response.result._source).match(data.body);
          should(mockupResponse.response.result.action).be.exactly('create');
          should(mockupResponse.response.result.controller).be.exactly('write');
          done();
        }
        catch (e) {
          done(e);
        }
      }, 20);
    });

    it('should not respond if the response is empty', function (done) {
      var
        params = { action: 'create', controller: 'write' },
        data = {body: {resolve: true, empty: true}, params: {collection: 'foobar'}};

      mockupResponse.init();
      executeFromRest.call(kuzzle, params, data, mockupResponse);

      setTimeout(function () {
        try {
          should(mockupResponse.ended).be.false();
          done();
        }
        catch (e) {
          done(e);
        }
      }, 20);
    });

    it('should respond with a HTTP 400 message in case of error', function (done) {
      var
        params = { action: 'create', controller: 'write' },
        data = {body: {resolve: false}, params: {collection: 'foobar'}};

      mockupResponse.init();
      executeFromRest.call(kuzzle, params, data, mockupResponse);

      setTimeout(function () {
        try {
          should(mockupResponse.statusCode).be.exactly(400);
          should(mockupResponse.header['Content-Type']).not.be.undefined();
          should(mockupResponse.header['Content-Type']).be.exactly('application/json');
          should(mockupResponse.response.error).not.be.null();
          should(mockupResponse.response.error).be.exactly('rejected');
          should(mockupResponse.response.result).be.null();
          done();
        }
        catch (e) {
          done(e);
        }
      }, 20);
    });

    it('should use the request content instead of the metadata to complete missing information', function (done) {
      var
        params = {controller: 'write' },
        data = {body: {resolve: true}, params: {collection: 'foobar',  action: 'create'}};

      mockupResponse.init();
      executeFromRest.call(kuzzle, params, data, mockupResponse);

      setTimeout(function () {
        try {
          should(mockupResponse.statusCode).be.exactly(200);
          should(mockupResponse.header['Content-Type']).not.be.undefined();
          should(mockupResponse.header['Content-Type']).be.exactly('application/json');
          should(mockupResponse.response.error).be.null();
          should(mockupResponse.response.result).be.not.null();
          should(mockupResponse.response.result.action).be.exactly('create');
          should(mockupResponse.response.result.controller).be.exactly('write');
          done();
        }
        catch (e) {
          done(e);
        }
      }, 20);
    });

    it('should copy any found "id" identifier', function (done) {
      var
        params = {controller: 'write' },
        data = {body: {resolve: true}, params: {collection: 'foobar',  action: 'create', id: 'fakeid'}};

      mockupResponse.init();
      executeFromRest.call(kuzzle, params, data, mockupResponse);

      setTimeout(function () {
        try {
          should(mockupResponse.statusCode).be.exactly(200);
          should(mockupResponse.header['Content-Type']).not.be.undefined();
          should(mockupResponse.header['Content-Type']).be.exactly('application/json');
          should(mockupResponse.response.error).be.null();
          should(mockupResponse.response.result).be.not.null();
          should(mockupResponse.response.result.action).be.exactly('create');
          should(mockupResponse.response.result.controller).be.exactly('write');
          should(mockupResponse.response.result._id).be.exactly('fakeid');
          done();
        }
        catch (e) {
          done(e);
        }
      }, 20);
    });
});

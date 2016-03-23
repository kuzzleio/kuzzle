var
  _ = require('lodash'),
  should = require('should'),
  q = require('q'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  redisCommands = require('redis-commands'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  MemoryStorageController = rewire('../../../lib/api/controllers/memoryStorageController.js'),
  msController,
  kuzzle,
  called,
  extractArgumentsFromRequestObject = MemoryStorageController.__get__('extractArgumentsFromRequestObject'),
  extractArgumentsFromRequestObjectForSet = MemoryStorageController.__get__('extractArgumentsFromRequestObjectForSet'),
  extractArgumentsFromRequestObjecForSort = MemoryStorageController.__get__('extractArgumentsFromRequestObjecForSort'),
  extractArgumentsFromRequestObjectForZInterstore = MemoryStorageController.__get__('extractArgumentsFromRequestObjectForZInterstore'),
  extractArgumentsFromRequestObjectForZRangeByLex = MemoryStorageController.__get__('extractArgumentsFromRequestObjectForZRangeByLex'),
  extractArgumentsFromRequestObjectForZRangeByScore = MemoryStorageController.__get__('extractArgumentsFromRequestObjectForZRangeByScore'),
  requestObject,
  testMapping,
  revertMapping;

before(function (done) {
  var wrapped = function (f) {
    return function () {
      if (called === undefined) {
        called = {};
      }
      called[f.name] = {
        called: true,
        args: Array.prototype.slice.call(arguments)
      };

      return f.apply(this, Array.prototype.slice.call(arguments));
    }
  }.bind(this);

  requestObject = new RequestObject({
    body: {
      _id: 'myKey',
      someArg: 'someValue',
      arrArg: [ 'I', 'am', 'sorry', 'Dave' ],
      arrArg2: [ 'All', 'your', 'base', 'are', 'belong', 'to', 'us' ]
    }
  });

  extractArgumentsFromRequestObjectForSet = wrapped(extractArgumentsFromRequestObjectForSet);
  extractArgumentsFromRequestObjecForSort = wrapped(extractArgumentsFromRequestObjecForSort);
  extractArgumentsFromRequestObjectForZInterstore = wrapped(extractArgumentsFromRequestObjectForZInterstore);
  extractArgumentsFromRequestObjectForZRangeByLex  = wrapped(extractArgumentsFromRequestObjectForZRangeByLex);
  extractArgumentsFromRequestObjectForZRangeByScore = wrapped(extractArgumentsFromRequestObjectForZRangeByScore);

  MemoryStorageController.__set__({
    extractArgumentsFromRequestObjectForSet: extractArgumentsFromRequestObjectForSet,
    extractArgumentsFromRequestObjecForSort: extractArgumentsFromRequestObjecForSort,
    extractArgumentsFromRequestObjectForZInterstore: extractArgumentsFromRequestObjectForZInterstore,
    extractArgumentsFromRequestObjectForZRangeByLex: extractArgumentsFromRequestObjectForZRangeByLex,
    extractArgumentsFromRequestObjectForZRangeByScore: extractArgumentsFromRequestObjectForZRangeByScore
  });

  kuzzle = new Kuzzle();
  kuzzle.start(params, {dummy: true})
    .then(() => {
      msController = new MemoryStorageController(kuzzle);

      testMapping = {
        mapping: {
          noarg: null,
          simplearg: {
            key: ['_id']
          },
          bodyarg: {
            arg: ['body', 'someArg']
          },
          skiparg: {
            arg1: {skip: true, path: ['body', 'missing']},
            arg2: {skip: true, path: ['body', 'someArg']}
          },
          mergearg: {
            arg: {merge: true, path: ['body', 'arrArg']}
          },
          maparg: {
            arg: {
              merge: true,
              path: ['body', 'arrArg2'],
              map: arg => {
                return arg.map(e => { return e.toUpperCase(); });
              }
            }
          }
        }
      };

      revertMapping = MemoryStorageController.__set__(testMapping);

      done();
    })
});

beforeEach(function () {
  called = {
    extractArgumentsFromRequestObjectForSet: false,
    extractArgumentsFromRequestObjecForSort: false,
    extractArgumentsFromRequestObjectForZInterstore: false,
    extractArgumentsFromRequestObjectForZRangeByLex: false,
    extractArgumentsFromRequestObjectForZRangeByScore: false
  };
});

describe('Test: cache controller', function () {

  describe('#constructor', function () {
    it('should not expose blacklisted methods', () => {
      var blacklist = MemoryStorageController.__get__('blacklist');

      should(blacklist).be.an.Array();
      should(blacklist).not.be.empty();

      blacklist.forEach(command => {
        should(msController[command]).be.undefined();
      });
    });

    it('should construct the allowed functions', () => {
      var
        blacklisted = MemoryStorageController.__get__('blacklist'),
        allowed = _.difference(redisCommands.list, blacklisted);

      should(allowed).be.an.Array();
      should(allowed).not.be.empty();

      allowed.forEach(command => {
        should(msController[command]).be.a.Function();
      });
    });
  });

  describe('#extractArgumentsFromRequestObject', function () {

    it('should return an empty array when the mapping does not list args', () => {
      var result = extractArgumentsFromRequestObject('noarg', requestObject);

      should(result).be.an.Array();
      should(result).be.empty();
    });

    it('should return the _id on the simple arg', function () {
        var result = extractArgumentsFromRequestObject('simplearg', requestObject);

        should(result).be.an.Array();
        should(result).length(1);
        should(result[0]).be.exactly('myKey');
    });

    it('should return an arg from the body', function () {
      var result = extractArgumentsFromRequestObject('bodyarg', requestObject);

      should(result).be.an.Array();
      should(result).length(1);
      should(result[0]).be.exactly('someValue');
    });

    it('should skip an missing argument if asked', function () {
      var result = extractArgumentsFromRequestObject('skiparg', requestObject);

      should(result).be.an.Array();
      should(result).length(1);
      should(result[0]).be.exactly('someValue');
    });

    it('should merge the arguments if asked', function () {
      var result = extractArgumentsFromRequestObject('mergearg', requestObject);

      should(result).be.an.Array();
      should(result).length(4);
      should(result).match(['I', 'am', 'sorry', 'Dave']);
    });

    it('should map the argument if asked', function () {
      var result = extractArgumentsFromRequestObject('maparg', requestObject);

      should(result).be.an.Array();
      should(result).length(7);
      should(result).match(['ALL', 'YOUR', 'BASE', 'ARE', 'BELONG', 'TO', 'US']);
    });

  });

  describe('#extractArgumentsFromRequestObjectForSet', function () {

    it('should be called from extractArgumentsFromRequestObject when calling "set"', function () {
      var result = extractArgumentsFromRequestObject('set', requestObject);

      should(called.extractArgumentsFromRequestObjectForSet.called).be.true();
    });

    it('should handle the _id + value + no option case', function () {
      var
        requestObject = new RequestObject({
          body: {
            _id: 'myKey',
            value: {
              foo: 'bar'
            }
          }
        }),
        result = extractArgumentsFromRequestObjectForSet(requestObject);

      should(result).be.an.Array();
      should(result).length(2);
      should(result[0]).be.exactly('myKey');
      should(result[1]).eql({ foo: 'bar'});
    });

    it('should handle the _id + no value + no option case', function () {
      var
        requestObject = new RequestObject({
          body: {
            _id: 'myKey',
            foo: 'bar'
          }
        }),
        result = extractArgumentsFromRequestObjectForSet(requestObject);

      should(result).be.an.Array();
      should(result).length(2);
      should(result[0]).be.exactly('myKey');
      should(result[1]).be.eql(requestObject.data.body);
    });

    it('should handle the optional parameters', function () {
      // NB: This is an invalid message but the method lets Redis handle the error (cannot mix NX & XX params)
      var
        requestObject = new RequestObject({
          body: {
            _id: 'myKey',
            value: {
              foo: 'bar'
            },
            ex: 111,
            px: 222,
            nx: true,
            xx: true
          }
        }),
        result = extractArgumentsFromRequestObjectForSet(requestObject);

      should(result).be.an.Array();
      should(result).length(6);
      should(result[0]).be.exactly('myKey');
      should(result[1]).be.exactly(requestObject.data.body.value);
      should(result[2]).be.exactly('PS');
      should(result[3]).be.exactly(222);
      should(result[4]).be.exactly('NX');
      should(result[5]).be.exactly('XX');
    });

  });
});

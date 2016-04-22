var
  _ = require('lodash'),
  should = require('should'),
  q = require('q'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  redisCommands = [],
  redisClientMock = require('../../mocks/services/redisClient.mock'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  MemoryStorageController = rewire('../../../lib/api/controllers/memoryStorageController.js'),
  msController,
  kuzzle,
  called,
  extractArgumentsFromRequestObject = MemoryStorageController.__get__('extractArgumentsFromRequestObject'),
  extractArgumentsFromRequestObjectForSet = MemoryStorageController.__get__('extractArgumentsFromRequestObjectForSet'),
  extractArgumentsFromRequestObjectForSort = MemoryStorageController.__get__('extractArgumentsFromRequestObjectForSort'),
  extractArgumentsFromRequestObjectForZAdd = MemoryStorageController.__get__('extractArgumentsFromRequestObjectForZAdd'),
  extractArgumentsFromRequestObjectForZInterstore = MemoryStorageController.__get__('extractArgumentsFromRequestObjectForZInterstore'),
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
    };
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
  extractArgumentsFromRequestObjectForSort = wrapped(extractArgumentsFromRequestObjectForSort);
  extractArgumentsFromRequestObjectForZAdd = wrapped(extractArgumentsFromRequestObjectForZAdd);
  extractArgumentsFromRequestObjectForZInterstore = wrapped(extractArgumentsFromRequestObjectForZInterstore);

  MemoryStorageController.__set__({
    extractArgumentsFromRequestObjectForSet: extractArgumentsFromRequestObjectForSet,
    extractArgumentsFromRequestObjectForSort: extractArgumentsFromRequestObjectForSort,
    extractArgumentsFromRequestObjectForZAdd: extractArgumentsFromRequestObjectForZAdd,
    extractArgumentsFromRequestObjectForZInterstore: extractArgumentsFromRequestObjectForZInterstore
  });

  kuzzle = new Kuzzle();
  kuzzle.start(params, {dummy: true})
    .then(() => {
      redisCommands = kuzzle.services.list.memoryStorage.commands;
      kuzzle.services.list.memoryStorage.client = redisClientMock;

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
    });
});

beforeEach(function () {
  called = {
    extractArgumentsFromRequestObjectForSet: false,
    extractArgumentsFromRequestObjectForSort: false,
    extractArgumentsFromRequestObjectForZAdd: false,
    extractArgumentsFromRequestObjectForZInterstore: false,
    extractArgumentsFromRequestObjectForZRangeByLex: false,
    extractArgumentsFromRequestObjectForZRangeByScore: false
  };
});

describe('Test: memoryStore controller', function () {

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

      delete requestObject.data.body.px;
      result = extractArgumentsFromRequestObjectForSet(requestObject);

      should(result).be.eql([
        'myKey',
        { foo: 'bar' },
        'EX',
        111,
        'NX'
      ]);
    });

  });

  describe('#extractArgumentsFromRequestObjectForSort', function () {

    it('should be called when extractArgumentsFromRequestObject is called with the "sort" command', () => {
      extractArgumentsFromRequestObject('sort', requestObject);

      should(called.extractArgumentsFromRequestObjectForSort.called).be.true();
      should(called.extractArgumentsFromRequestObjectForSort.args).be.eql([requestObject]);
    });

    it ('should handle the request if no optional parameter is given', () => {
      var
        requestObject = new RequestObject({
          body: {
            _id: 'myKey'
          }
        }),
        result = extractArgumentsFromRequestObjectForSort(requestObject);

      should(result).be.an.Array();
      should(result).length(1);
      should(result[0]).be.exactly('myKey');
    });

    it('should handle a request with some optional parameters', () => {
      var
        requestObject = new RequestObject({
          body: {
            _id: 'myKey',
            alpha: true,
            direction: 'DESC',
            by: 'byParam',
            offset: 10,
            count: 20,
            get: 'getParam',
            store: 'storeParam'
          }
        }),
        result = extractArgumentsFromRequestObjectForSort(requestObject);

      should(result).be.an.Array();
      should(result).length(12);
      should(result).eql(['myKey', 'ALPHA', 'DESC', 'BY', 'byParam', 'LIMIT', 10, 20, 'GET', 'getParam', 'STORE', 'storeParam']);
    });

  });

  describe('#extractArgumentsFromRequestObjectForZAdd', function () {

    it('should be called from extractArgumentsFromRequestObject when the command "zadd" is called', () => {
      extractArgumentsFromRequestObject('zadd', requestObject);

      should(called.extractArgumentsFromRequestObjectForZAdd.called).be.true();
      should(called.extractArgumentsFromRequestObjectForZAdd.args).be.eql([requestObject]);
    });

    it('should extract any given argument', () => {
      var
        requestObject = new RequestObject({
          body: {
            _id: 'myKey',
            nx: true,
            xx: true,
            ch: true,
            incr: true,
            score: 'scoreVal',
            member: 'memberVal',
            values: [
              { score: 1, member: 'm1' },
              { score: 2, member: 'm2' },
              { score: 3, member: 'm3' }
            ]
          }
        }),
        result = extractArgumentsFromRequestObjectForZAdd(requestObject);

      should(result).be.an.Array();
      should(result).length(12);
      should(result).eql(['myKey', 'NX', 'CH', 'INCR', 'scoreVal', 'memberVal', 1, 'm1', 2, 'm2', 3, 'm3']);

      delete requestObject.data.body.nx;
      result = extractArgumentsFromRequestObjectForZAdd(requestObject);

      should(result).eql([
        'myKey',
        'XX',
        'CH',
        'INCR',
        'scoreVal',
        'memberVal',
        1,
        'm1',
        2,
        'm2',
        3,
        'm3'
      ]);
    });

  });

  describe('#extractArgumentsFromRequestObjectForZInterstore', function () {

    it('should be called from extractArgumentsFromRequestObject for the "zinterstore" command', () => {
      extractArgumentsFromRequestObject('zinterstore', requestObject);

      should(called.extractArgumentsFromRequestObjectForZInterstore.called).be.true();
      should(called.extractArgumentsFromRequestObjectForZInterstore.args).be.eql([requestObject]);
    });

    it('should be called from extractArgumentsFromRequestObject for the "zuninonstore" command', () => {
      extractArgumentsFromRequestObject('zunionstore', requestObject);

      should(called.extractArgumentsFromRequestObjectForZInterstore.called).be.true();
      should(called.extractArgumentsFromRequestObjectForZInterstore.args).be.eql([requestObject]);
    });

    it('should extract any given argument', () => {
      var
        requestObject = new RequestObject({
          body: {
            _id: 'myKey',
            destination: 'destinationVal',
            keys: [
              'key2',
              'key3'
            ],
            weight: 'singleWeightVal',
            weights: [
              'weight1',
              'weight2'
            ],
            aggregate: 'aggregateVal'
          }
        }),
        result = extractArgumentsFromRequestObjectForZInterstore(requestObject);

      should(result).be.an.Array();
      should(result).length(11);
      should(result).eql([
        'destinationVal',
        3,
        'myKey',
        'key2',
        'key3',
        'WEIGHTS',
        'singleWeightVal',
        'weight1',
        'weight2',
        'AGGREGATE',
        'AGGREGATEVAL'
      ]);
    });

    it('should throw an error an invalid keys parameter is given', () => {
      var
        requestObject = new RequestObject({
          body: {
            keys: 'unvalid value'
          }
        });

      should(extractArgumentsFromRequestObjectForZInterstore.bind(null, requestObject)).throw(BadRequestError);

      requestObject = new RequestObject({
        body: {
          weights: 'unvalid'
        }
      });
      should(extractArgumentsFromRequestObjectForZInterstore.bind(null, requestObject)).throw(BadRequestError);

    });
  });

  describe('#generated functions', function () {

    before(function () {
      revertMapping();
    });

    after(function () {
      MemoryStorageController.__set__({
        mapping: testMapping
      });
    });

    it('should return a valid ResponseObject', done => {
      var rq = new RequestObject({
        controller: 'memoryStore',
        action: 'set',
        body: {
          _id: 'myKey',
          foo: 'bar'
        }
      });

      msController.set(rq)
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          should(response.data.body.result.name).be.exactly('set');
          should(response.data.body.result.args).length(2);
          should(response.data.body.result.args[0]).be.exactly('myKey');
          should(response.data.body.result.args[1]).be.eql(rq.data.body);

          done();
        })
        .catch(error => {
          console.log(error);
          done();
        });
    });

    it('custom mapping checks - zrange', done => {
      var
        rq = new RequestObject({
          controller: 'memoryStore',
          action: 'zrange',
          body: {
            _id: 'myKey',
            start: 'startVal',
            stop: 'stopVal',
            withscores: true
          }
        });

      msController.zrange(rq)
        .then(response => {
          should(response.data.body.result.name).be.exactly('zrange');
          should(response.data.body.result.args).be.eql([
            'myKey',
            'startVal',
            'stopVal',
            'WITHSCORES'
          ]);

          done();
        });
    });

    it('custom mapping checks - zrangebylex', done => {
      var
        rq = new RequestObject({
          controller: 'memoryStore',
          action: 'zrangebylex',
          body: {
            _id: 'myKey',
            min: 'minVal',
            max: 'maxVal',
            offset: 'offsetVal',
            count: 'countVal'
          }
        }),
        expected = [
          'myKey',
          'minVal',
          'maxVal',
          'LIMIT',
          'offsetVal',
          'countVal'
        ];

      msController.zrangebylex(rq)
        .then(response => {
          should(response.data.body.result.name).be.exactly('zrangebylex');
          should(response.data.body.result.args).be.eql(expected);

          rq.action = 'zrevrangebylex';

          return msController.zrevrangebylex(rq);
        })
        .then(response => {
          expected[1] = expected[2];
          expected[2] = 'minVal';

          should(response.data.body.result.name).be.exactly('zrevrangebylex');
          should(response.data.body.result.args).be.eql(expected);

          done();
        })
        .catch(err => done(err));
    });

    it('custom mapping checks - zrangebyscore', done => {
      var
        rq = new RequestObject({
          controller: 'memoryStore',
          acion: 'zrangebyscore',
          body: {
            _id: 'myKey',
            min: 'minVal',
            max: 'maxVal',
            withscores: true,
            offset: 'offsetVal',
            count: 'countVal'
          }
        }),
        expected = [
          'myKey',
          'minVal',
          'maxVal',
          'WITHSCORES',
          'LIMIT',
          'offsetVal',
          'countVal'
        ];

      msController.zrangebyscore(rq)
        .then(response => {
          should(response.data.body.result.name).be.exactly('zrangebyscore');
          should(response.data.body.result.args).be.eql(expected);

          rq.action = 'zrevrangebyscore';

          return msController.zrevrangebyscore(rq);
        })
        .then(response => {
          expected[1] = expected[2];
          expected[2] = 'minVal';

          should(response.data.body.result.name).be.exactly('zrevrangebyscore');
          should(response.data.body.result.args).be.eql(expected);

          done();
        })
        .catch(err => done(err));
    });

  });

});

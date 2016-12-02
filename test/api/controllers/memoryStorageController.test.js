var
  _ = require('lodash'),
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  rewire = require('rewire'),
  Kuzzle = require('../../../lib/api/kuzzle'),
  Redis = rewire('../../../lib/services/redis'),
  RedisClientMock = require('../../mocks/services/redisClient.mock'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  Request = require('kuzzle-common-objects').Request,
  MemoryStorageController = rewire('../../../lib/api/controllers/memoryStorageController.js');

describe('Test: memoryStorage controller', () => {

  var
    dbname = 'unit-tests',
    msController,
    called,
    extractArgumentsFromRequest,
    extractArgumentsFromRequestForSet,
    extractArgumentsFromRequestForSort,
    extractArgumentsFromRequestForZAdd,
    extractArgumentsFromRequestForZInterstore,
    requestObject,
    testMapping,
    origMapping,
    kuzzle;

  before(() => {
    var
      wrapped = f => {
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
      };

    testMapping = {
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
    };

    extractArgumentsFromRequest = wrapped(MemoryStorageController.__get__('extractArgumentsFromRequest'));
    extractArgumentsFromRequestForSet = wrapped(MemoryStorageController.__get__('extractArgumentsFromRequestForSet'));
    extractArgumentsFromRequestForSort = wrapped(MemoryStorageController.__get__('extractArgumentsFromRequestForSort'));
    extractArgumentsFromRequestForZAdd = wrapped(MemoryStorageController.__get__('extractArgumentsFromRequestForZAdd'));
    extractArgumentsFromRequestForZInterstore = wrapped(MemoryStorageController.__get__('extractArgumentsFromRequestForZInterstore'));

    MemoryStorageController.__set__({
      extractArgumentsFromRequestForSet: extractArgumentsFromRequestForSet,
      extractArgumentsFromRequestForSort: extractArgumentsFromRequestForSort,
      extractArgumentsFromRequestForZAdd: extractArgumentsFromRequestForZAdd,
      extractArgumentsFromRequestForZInterstore: extractArgumentsFromRequestForZInterstore
    });

    kuzzle = new Kuzzle();
    kuzzle.services.list.memoryStorage = new Redis(kuzzle, {service: dbname}, kuzzle.config.services.memoryStorage);
    return Redis.__with__('buildClient', () => new RedisClientMock())(() => {
      return kuzzle.services.list.memoryStorage.init();
    });
  });

  beforeEach(() => {
    requestObject = new Request({
      body: {
        _id: 'myKey',
        someArg: 'someValue',
        arrArg: [ 'I', 'am', 'sorry', 'Dave' ],
        arrArg2: [ 'All', 'your', 'base', 'are', 'belong', 'to', 'us' ]
      }
    });

    called = {
      extractArgumentsFromRequestForSet: false,
      extractArgumentsFromRequestForSort: false,
      extractArgumentsFromRequestForZAdd: false,
      extractArgumentsFromRequestForZInterstore: false,
      extractArgumentsFromRequestForZRangeByLex: false,
      extractArgumentsFromRequestForZRangeByScore: false
    };

    msController = new MemoryStorageController(kuzzle);
    origMapping = MemoryStorageController.__get__('mapping');
    MemoryStorageController.__set__({mapping: testMapping});
  });

  afterEach(() => {
    sandbox.restore();
    MemoryStorageController.__set__({mapping: origMapping});
  });

  describe('#constructor', () => {
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
        allowed = _.difference(kuzzle.services.list.memoryStorage.commands, blacklisted);
      should(allowed).be.an.Array();
      should(allowed).not.be.empty();

      allowed.forEach(command => {
        should(msController[command]).be.a.Function();
      });
    });
  });

  describe('#extractArgumentsFromRequest', () => {

    it('should return an empty array when the mapping does not list args', () => {
      var result = extractArgumentsFromRequest('noarg', requestObject);

      should(result).be.an.Array();
      should(result).be.empty();
    });

    it('should return the _id on the simple arg', () => {
      var result = extractArgumentsFromRequest('simplearg', requestObject);

      should(result).be.an.Array();
      should(result).length(1);
      should(result[0]).be.exactly('myKey');
    });

    it('should return an arg from the body', () => {
      var result = extractArgumentsFromRequest('bodyarg', requestObject);

      should(result).be.an.Array();
      should(result).length(1);
      should(result[0]).be.exactly('someValue');
    });

    it('should skip an missing argument if asked', () => {
      var result = extractArgumentsFromRequest('skiparg', requestObject);

      should(result).be.an.Array();
      should(result).length(1);
      should(result[0]).be.exactly('someValue');
    });

    it('should merge the arguments if asked', () => {
      var result = extractArgumentsFromRequest('mergearg', requestObject);

      should(result).be.an.Array();
      should(result).length(4);
      should(result).match(['I', 'am', 'sorry', 'Dave']);
    });

    it('should map the argument if asked', () => {
      var result = extractArgumentsFromRequest('maparg', requestObject);

      should(result).be.an.Array();
      should(result).length(7);
      should(result).match(['ALL', 'YOUR', 'BASE', 'ARE', 'BELONG', 'TO', 'US']);
    });

  });

  describe('#extractArgumentsFromRequestForSet', () => {

    it('should be called from extractArgumentsFromRequest when calling "set"', () => {
      extractArgumentsFromRequest('set', requestObject);

      should(called.extractArgumentsFromRequestForSet.called).be.true();
    });

    it('should handle the _id + value + no option case', () => {
      var
        request = new Request({
          body: {
            _id: 'myKey',
            value: {
              foo: 'bar'
            }
          }
        }),
        result = extractArgumentsFromRequestForSet(request);

      should(result).be.an.Array();
      should(result).length(2);
      should(result[0]).be.exactly('myKey');
      should(result[1]).eql({ foo: 'bar'});
    });

    it('should handle the _id + no value + no option case', () => {
      var
        request = new Request({
          body: {
            _id: 'myKey',
            foo: 'bar'
          }
        }),
        result = extractArgumentsFromRequestForSet(request);

      should(result).be.an.Array();
      should(result).length(2);
      should(result[0]).be.exactly('myKey');
      should(result[1]).be.eql(request.data.body);
    });

    it('should handle the optional parameters', () => {
      // NB: This is an invalid message but the method lets Redis handle the error (cannot mix NX & XX params)
      var
        request = new Request({
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
        result = extractArgumentsFromRequestForSet(request);

      should(result).be.an.Array();
      should(result).length(6);
      should(result[0]).be.exactly('myKey');
      should(result[1]).be.exactly(request.data.body.value);
      should(result[2]).be.exactly('PS');
      should(result[3]).be.exactly(222);
      should(result[4]).be.exactly('NX');
      should(result[5]).be.exactly('XX');

      delete request.data.body.px;
      result = extractArgumentsFromRequestForSet(request);

      should(result).be.eql([
        'myKey',
        { foo: 'bar' },
        'EX',
        111,
        'NX'
      ]);
    });

  });

  describe('#extractArgumentsFromRequestForSort', () => {

    it('should be called when extractArgumentsFromRequest is called with the "sort" command', () => {
      extractArgumentsFromRequest('sort', requestObject);

      should(called.extractArgumentsFromRequestForSort.called).be.true();
      should(called.extractArgumentsFromRequestForSort.args).be.eql([requestObject]);
    });

    it ('should handle the request if no optional parameter is given', () => {
      var
        request = new Request({
          body: {
            _id: 'myKey'
          }
        }),
        result = extractArgumentsFromRequestForSort(request);

      should(result).be.an.Array();
      should(result).length(1);
      should(result[0]).be.exactly('myKey');
    });

    it('should handle a request with some optional parameters', () => {
      var
        request = new Request({
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
        result = extractArgumentsFromRequestForSort(request);

      should(result).be.an.Array();
      should(result).length(12);
      should(result).eql(['myKey', 'ALPHA', 'DESC', 'BY', 'byParam', 'LIMIT', 10, 20, 'GET', 'getParam', 'STORE', 'storeParam']);
    });

  });

  describe('#extractArgumentsFromRequestForZAdd', () => {

    it('should be called from extractArgumentsFromRequest when the command "zadd" is called', () => {
      extractArgumentsFromRequest('zadd', requestObject);

      should(called.extractArgumentsFromRequestForZAdd.called).be.true();
      should(called.extractArgumentsFromRequestForZAdd.args).be.eql([requestObject]);
    });

    it('should extract any given argument', () => {
      var
        request = new Request({
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
        result = extractArgumentsFromRequestForZAdd(request);

      should(result).be.an.Array();
      should(result).length(12);
      should(result).eql(['myKey', 'NX', 'CH', 'INCR', 'scoreVal', 'memberVal', 1, 'm1', 2, 'm2', 3, 'm3']);

      delete request.data.body.nx;
      result = extractArgumentsFromRequestForZAdd(request);

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

  describe('#extractArgumentsFromRequestForZInterstore', () => {

    it('should be called from extractArgumentsFromRequest for the "zinterstore" command', () => {
      extractArgumentsFromRequest('zinterstore', requestObject);

      should(called.extractArgumentsFromRequestForZInterstore.called).be.true();
      should(called.extractArgumentsFromRequestForZInterstore.args).be.eql([requestObject]);
    });

    it('should be called from extractArgumentsFromRequest for the "zuninonstore" command', () => {
      extractArgumentsFromRequest('zunionstore', requestObject);

      should(called.extractArgumentsFromRequestForZInterstore.called).be.true();
      should(called.extractArgumentsFromRequestForZInterstore.args).be.eql([requestObject]);
    });

    it('should extract any given argument', () => {
      var
        request = new Request({
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
        result = extractArgumentsFromRequestForZInterstore(request);

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
        request = new Request({
          body: {
            keys: 'unvalid value'
          }
        });

      should(extractArgumentsFromRequestForZInterstore.bind(null, request)).throw(BadRequestError);

      request = new Request({
        body: {
          weights: 'unvalid'
        }
      });
      should(extractArgumentsFromRequestForZInterstore.bind(null, request)).throw(BadRequestError);

    });
  });

  describe('#generated functions', () => {

    beforeEach(() => {
      MemoryStorageController.__set__({mapping: origMapping});
    });

    it('should return a valid response', () => {
      var request = new Request({
        controller: 'memoryStore',
        action: 'set',
        body: {
          _id: 'myKey',
          foo: 'bar'
        }
      });

      return msController.set(request, {})
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          // TODO test response format
          should(response.responseObject.data.body.name).be.exactly('set');
          should(response.responseObject.data.body.args).length(2);
          should(response.responseObject.data.body.args[0]).be.exactly('myKey');
          should(response.responseObject.data.body.args[1]).be.eql(request.data.body);
        });
    });

    it('custom mapping checks - zrange', () => {
      var
        request = new Request({
          controller: 'memoryStore',
          action: 'zrange',
          body: {
            _id: 'myKey',
            start: 'startVal',
            stop: 'stopVal',
            withscores: true
          }
        });

      return msController.zrange(request, {})
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          // TODO test response format
          should(response.responseObject.data.body.name).be.exactly('zrange');
          should(response.responseObject.data.body.args).be.eql([
            'myKey',
            'startVal',
            'stopVal',
            'WITHSCORES'
          ]);
        });
    });

    it('custom mapping checks - zrangebylex', () => {
      var
        request = new Request({
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

      return msController.zrangebylex(request, {})
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          // TODO test response format
          should(response.responseObject.data.body.name).be.exactly('zrangebylex');
          should(response.responseObject.data.body.args).be.eql(expected);

          request.action = 'zrevrangebylex';

          return msController.zrevrangebylex(request, {});
        })
        .then(response => {
          expected[1] = expected[2];
          expected[2] = 'minVal';

          should(response.userContext).be.instanceof(Object);
          // TODO test response format
          should(response.responseObject.data.body.name).be.exactly('zrevrangebylex');
          should(response.responseObject.data.body.args).be.eql(expected);

        });
    });

    it('custom mapping checks - zrangebyscore', () => {
      var
        request = new Request({
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

      return msController.zrangebyscore(request, {})
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          // TODO test response format
          should(response.responseObject.data.body.name).be.exactly('zrangebyscore');
          should(response.responseObject.data.body.args).be.eql(expected);

          request.action = 'zrevrangebyscore';

          return msController.zrevrangebyscore(request, {});
        })
        .then(response => {
          expected[1] = expected[2];
          expected[2] = 'minVal';

          should(response.userContext).be.instanceof(Object);
          // TODO test response format
          should(response.responseObject.data.body.name).be.exactly('zrevrangebyscore');
          should(response.responseObject.data.body.args).be.eql(expected);
        });
    });
  });
});

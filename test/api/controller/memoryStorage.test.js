'use strict';

const should = require('should');
const rewire = require('rewire');
const KuzzleMock = require('../../mocks/kuzzle.mock');
const RedisClientMock = require('../../mocks/service/redisClient.mock');
const { NativeController } = require('../../../lib/api/controller/base');
const {
  Request,
  BadRequestError
} = require('kuzzle-common-objects');
const MemoryStorageController = rewire('../../../lib/api/controller/memoryStorage.js');

describe('MemoryStorageController', () => {
  let msController;
  let called;
  let extractArgumentsFromRequest;
  let extractArgumentsFromRequestForSet;
  let extractArgumentsFromRequestForSort;
  let extractArgumentsFromRequestForZAdd;
  let extractArgumentsFromRequestForZInterstore;
  let extractArgumentsFromRequestForMExecute;
  let request;
  let testMapping;
  let origMapping;
  let kuzzle;

  before(() => {
    const
      wrapped = f => {
        return function () {
          let args = Array.prototype.slice.call(arguments);

          if (called === undefined) {
            called = {};
          }

          called[f.name] = {called: true, args};
          return f(...args);
        };
      };

    testMapping = {
      noarg: null,
      simplearg: {
        key: ['resource', '_id']
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
          map: arg => arg.map(e => e.toUpperCase())
        }
      }
    };

    extractArgumentsFromRequest = wrapped(MemoryStorageController.__get__('extractArgumentsFromRequest'));
    extractArgumentsFromRequestForSet = wrapped(MemoryStorageController.__get__('extractArgumentsFromRequestForSet'));
    extractArgumentsFromRequestForSort = wrapped(MemoryStorageController.__get__('extractArgumentsFromRequestForSort'));
    extractArgumentsFromRequestForZAdd = wrapped(MemoryStorageController.__get__('extractArgumentsFromRequestForZAdd'));
    extractArgumentsFromRequestForZInterstore = wrapped(MemoryStorageController.__get__('extractArgumentsFromRequestForZInterstore'));
    extractArgumentsFromRequestForMExecute = wrapped(MemoryStorageController.__get__('extractArgumentsFromRequestForMExecute'));

    MemoryStorageController.__set__({
      extractArgumentsFromRequestForSet: extractArgumentsFromRequestForSet,
      extractArgumentsFromRequestForSort: extractArgumentsFromRequestForSort,
      extractArgumentsFromRequestForZAdd: extractArgumentsFromRequestForZAdd,
      extractArgumentsFromRequestForZInterstore: extractArgumentsFromRequestForZInterstore,
      extractArgumentsFromRequestForMExecute: extractArgumentsFromRequestForMExecute
    });

    kuzzle = new KuzzleMock();
    kuzzle.cacheEngine.public = new RedisClientMock();
  });

  beforeEach(() => {
    request = new Request({
      _id: 'myKey',
      body: {
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
    MemoryStorageController.__set__({mapping: origMapping});
  });

  describe('#constructor', () => {
    it('should construct the allowed functions', () => {
      const allowed = Object.keys(origMapping);

      should(allowed).not.be.empty();

      allowed.forEach(command => {
        should(msController[command]).be.a.Function();
      });
    });

    it('should inherit the base constructor', () => {
      should(msController).instanceOf(NativeController);
    });

    it('should properly override the isAction method', () => {
      msController._foobar = () => {};
      should(msController._isAction('flushdb')).be.true();
      should(msController._isAction('_foobar')).be.false();
    });
  });

  describe('#extractArgumentsFromRequest', () => {

    it('should return an empty array when the mapping does not list args', () => {
      var result = extractArgumentsFromRequest('noarg', request);

      should(result).be.an.Array();
      should(result).be.empty();
    });

    it('should return the _id on the simple arg', () => {
      var result = extractArgumentsFromRequest('simplearg', request);

      should(result).be.an.Array();
      should(result).length(1);
      should(result[0]).be.exactly('myKey');
    });

    it('should return an arg from the body', () => {
      var result = extractArgumentsFromRequest('bodyarg', request);

      should(result).be.an.Array();
      should(result).length(1);
      should(result[0]).be.exactly('someValue');
    });

    it('should skip an missing argument if asked', () => {
      var result = extractArgumentsFromRequest('skiparg', request);

      should(result).be.an.Array();
      should(result).length(1);
      should(result[0]).be.exactly('someValue');
    });

    it('should merge the arguments if asked', () => {
      var result = extractArgumentsFromRequest('mergearg', request);

      should(result).be.an.Array();
      should(result).length(4);
      should(result).match(['I', 'am', 'sorry', 'Dave']);
    });

    it('should map the argument if asked', () => {
      var result = extractArgumentsFromRequest('maparg', request);

      should(result).be.an.Array();
      should(result).length(7);
      should(result).match(['ALL', 'YOUR', 'BASE', 'ARE', 'BELONG', 'TO', 'US']);
    });

  });

  describe('#extractArgumentsFromRequestForSet', () => {
    it('should be called from extractArgumentsFromRequest when calling "set"', () => {
      request.input.body.value = 'foobar';
      extractArgumentsFromRequest('set', request);

      should(called.extractArgumentsFromRequestForSet.called).be.true();
    });

    it('should handle the _id + value + no option case', () => {
      const
        req = new Request({
          _id: 'myKey',
          body: {
            value: 'bar'
          }
        }),
        result = extractArgumentsFromRequestForSet(req);

      should(result).be.an.Array();
      should(result).length(2);
      should(result[0]).be.exactly('myKey');
      should(result[1]).eql('bar');
    });

    it('should handle optional parameters', () => {
      let
        req = new Request({
          _id: 'myKey',
          body: {
            value: 'bar',
            nx: true,
            px: 123
          }
        }),
        result = extractArgumentsFromRequestForSet(req);

      should(result).be.an.Array();
      should(result).length(5);
      should(result).match(['myKey', 'bar', 'PX', 123, 'NX']);
    });

    it('should throw when there is an invalid or missing value', () => {
      let
        req = new Request({
          _id: 'myKey',
          body: {
          }
        });

      should(() => extractArgumentsFromRequestForSet(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });
      req.input.body.value = { foo: 'bar' };
      should(() => extractArgumentsFromRequestForSet(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });
    });

    it('should throw if NX and XX are set together', () => {
      const
        req = new Request({
          _id: 'myKey',
          body: {
            value: 'bar',
            nx: true,
            xx: true
          }
        });

      should(() => extractArgumentsFromRequestForSet(req))
        .throw(BadRequestError, { id: 'api.assert.mutually_exclusive'});
    });

    it('should throw if EX and PX are set together', () => {
      const
        req = new Request({
          _id: 'myKey',
          body: {
            value: 'bar',
            px: 123,
            ex: 456
          }
        });

      should(() => extractArgumentsFromRequestForSet(req))
        .throw(BadRequestError, { id: 'api.assert.mutually_exclusive'});
    });
  });

  describe('#extractArgumentsFromRequestForSort', () => {
    it('should be called when extractArgumentsFromRequest is called with the "sort" command', () => {
      extractArgumentsFromRequest('sort', request);

      should(called.extractArgumentsFromRequestForSort.called).be.true();
      should(called.extractArgumentsFromRequestForSort.args).be.eql([request]);
    });

    it('should throw if no id is provided', () => {
      const req = new Request({});

      should(() => extractArgumentsFromRequestForSort(req))
        .throw(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it ('should handle the request if no optional parameter is given', () => {
      const
        req = new Request({
          _id: 'myKey'
        }),
        result = extractArgumentsFromRequestForSort(req);

      should(result).be.an.Array();
      should(result).length(1);
      should(result[0]).be.exactly('myKey');
    });

    it('should handle a request with some optional parameters', () => {
      const
        req = new Request({
          _id: 'myKey',
          body: {
            alpha: true,
            direction: 'DESC',
            by: 'pattern',
            limit: [10, 20],
            get: ['pattern1', 'pattern2'],
            store: 'storeParam'
          }
        }),
        result = extractArgumentsFromRequestForSort(req);

      should(result).be.an.Array();
      should(result).length(14);
      should(result).eql(['myKey', 'ALPHA', 'DESC', 'BY', 'pattern', 'LIMIT', 10, 20, 'GET', 'pattern1', 'GET', 'pattern2', 'STORE', 'storeParam']);
    });

    it('should throw if an invalid limit parameter is provided', () => {
      let req = new Request({
        _id: 'myKey',
        body: {
          limit: {offset: 10, count: 20}
        }
      });

      should(() => extractArgumentsFromRequestForSort(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });

      req.input.body.limit = [10];
      should(() => extractArgumentsFromRequestForSort(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });

      req.input.body.limit = [10, 'foo'];
      should(() => extractArgumentsFromRequestForSort(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });

      req.input.body.limit = [null, 20];
      should(() => extractArgumentsFromRequestForSort(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });

      req.input.body.limit = [10, [20]];
      should(() => extractArgumentsFromRequestForSort(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });
    });

    it('should throw if an invalid direction parameter is provided', () => {
      let req = new Request({
        _id: 'myKey',
        body: {
          direction: 'foo'
        }
      });

      should(() => extractArgumentsFromRequestForSort(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_argument' });

      req.input.body.direction = 'asc';
      should(() => extractArgumentsFromRequestForSort(req)).not.throw();

      req.input.body.direction = 'DeSc';
      should(() => extractArgumentsFromRequestForSort(req)).not.throw();
    });
  });

  describe('#extractArgumentsFromRequestForZAdd', () => {
    it('should be called from extractArgumentsFromRequest when the command "zadd" is called', () => {
      request.input.body.elements = [{score: 123, member: 'bar'}];
      extractArgumentsFromRequest('zadd', request);

      should(called.extractArgumentsFromRequestForZAdd.called).be.true();
      should(called.extractArgumentsFromRequestForZAdd.args).be.eql([request]);
    });

    it('should extract any given argument', () => {
      const
        req = new Request({
          _id: 'myKey',
          body: {
            nx: true,
            ch: true,
            incr: true,
            elements: [
              { score: 1, member: 'm1' }
            ]
          }
        });

      let result = extractArgumentsFromRequestForZAdd(req);

      should(result).be.an.Array();
      should(result).length(6);
      should(result).eql(['myKey', 'NX', 'CH', 'INCR', 1, 'm1']);

      delete req.input.body.nx;
      delete req.input.body.incr;
      req.input.body.xx = true;
      req.input.body.elements.push({score: 2, member: 'm2'});
      req.input.body.elements.push({score: 3, member: 'm3'});
      result = extractArgumentsFromRequestForZAdd(req);

      should(result).eql(['myKey', 'XX', 'CH', 1, 'm1', 2, 'm2', 3, 'm3']);
    });

    it('should throw if no id is provided', () => {
      const
        req = new Request({
          body: {
            nx: true,
            ch: true,
            incr: true,
            elements: [
              { score: 1, member: 'm1' }
            ]
          }
        });

      should(() => extractArgumentsFromRequestForZAdd(req))
        .throw(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should throw if an invalid or missing elements parameter is provided', () => {
      const
        req = new Request({
          _id: 'myKey',
          body: {
            nx: true,
            ch: true,
            incr: true,
          }
        });

      should(() => extractArgumentsFromRequestForZAdd(req))
        .throw(BadRequestError, { id: 'api.assert.missing_argument'});

      req.input.body.elements = { score: 1, member: 'm1' };
      should(() => extractArgumentsFromRequestForZAdd(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });

      req.input.body.elements = [];
      should(() => extractArgumentsFromRequestForZAdd(req))
        .throw(BadRequestError, { id: 'api.assert.empty_argument' });

      req.input.body.elements = [{ score: 1}];
      should(() => extractArgumentsFromRequestForZAdd(req))
        .throw(BadRequestError, { id: 'api.assert.missing_argument' });

      req.input.body.elements = [{ member: 'm1'}];
      should(() => extractArgumentsFromRequestForZAdd(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });

      req.input.body.elements = [{ score: 'foo', member: 'm1'}];
      should(() => extractArgumentsFromRequestForZAdd(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });

      req.input.body.elements = [{ score: 1.23, member: 'm1'}];
      should(() => extractArgumentsFromRequestForZAdd(req)).not.throw(BadRequestError);

      req.input.body.elements = [{ score: '1.23', member: 'm1'}];
      should(() => extractArgumentsFromRequestForZAdd(req)).not.throw(BadRequestError);
    });

    it('should throw if both NX and XX parameters are provided', () => {
      const
        req = new Request({
          _id: 'myKey',
          body: {
            nx: true,
            xx: true,
            elements: [
              { score: 1, member: 'm1' }
            ]
          }
        });

      should(() => extractArgumentsFromRequestForZAdd(req))
        .throw(BadRequestError, { id: 'api.assert.mutually_exclusive' });
    });

    it('should throw if multiple elements are provided with the INCR option set', () => {
      const
        req = new Request({
          _id: 'myKey',
          body: {
            incr: true,
            elements: [
              { score: 1, member: 'm1' },
              { score: 2, member: 'm2' }
            ]
          }
        });

      should(() => extractArgumentsFromRequestForZAdd(req))
        .throw(BadRequestError, { id: 'api.assert.too_many_arguments' });
    });
  });

  describe('#extractArgumentsFromRequestForZInterstore', () => {
    it('should be called from extractArgumentsFromRequest for the "zinterstore" command', () => {
      request.input.body.keys = ['key'];
      extractArgumentsFromRequest('zinterstore', request);

      should(called.extractArgumentsFromRequestForZInterstore.called).be.true();
      should(called.extractArgumentsFromRequestForZInterstore.args).be.eql([request]);
    });

    it('should be called from extractArgumentsFromRequest for the "zuninonstore" command', () => {
      request.input.body.keys = ['key'];
      extractArgumentsFromRequest('zunionstore', request);

      should(called.extractArgumentsFromRequestForZInterstore.called).be.true();
      should(called.extractArgumentsFromRequestForZInterstore.args).be.eql([request]);
    });

    it('should extract any given argument', () => {
      const
        req = new Request({
          _id: 'myKey',
          body: {
            keys: ['key1', 'key2', 'key3'],
            weights: ['weight1', 'weight2'],
            aggregate: 'min'
          }
        }),
        result = extractArgumentsFromRequestForZInterstore(req);

      should(result).be.an.Array();
      should(result).length(10);
      should(result).eql([
        'myKey',
        3,
        'key1',
        'key2',
        'key3',
        'WEIGHTS',
        'weight1',
        'weight2',
        'AGGREGATE',
        'MIN'
      ]);
    });

    it('should throw an error an invalid keys parameter is given', () => {
      const
        req = new Request({
          _id: 'myKey',
          body: {
            keys: 'unvalid value'
          }
        });

      should(() => extractArgumentsFromRequestForZInterstore(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });

      req.input.body.keys = [];
      should(() => extractArgumentsFromRequestForZInterstore(req))
        .throw(BadRequestError, { id: 'api.assert.empty_argument' });

      delete req.input.body.keys;
      should(() => extractArgumentsFromRequestForZInterstore(req))
        .throw(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should throw if no id is provided', () => {
      const
        req = new Request({
          body: {
            keys: ['key']
          }
        });

      should(() => extractArgumentsFromRequestForZInterstore(req))
        .throw(BadRequestError, { id: 'api.assert.missing_argument'});
    });

    it('should throw if an invalid aggregate parameter is provided', () => {
      const
        req = new Request({
          _id: 'myKey',
          body: {
            keys: ['key1', 'key2', 'key3'],
            aggregate: 'foo'
          }
        });

      should(() => extractArgumentsFromRequestForZInterstore(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_argument' });

      req.input.body.aggregate = 'min';
      should(() => extractArgumentsFromRequestForZInterstore(req)).not.throw();

      req.input.body.aggregate = 'SuM';
      should(() => extractArgumentsFromRequestForZInterstore(req)).not.throw();

      req.input.body.aggregate = 'MAX';
      should(() => extractArgumentsFromRequestForZInterstore(req)).not.throw();
    });

    it('should throw if an invalid weights parameter is provided', () => {
      const
        req = new Request({
          _id: 'myKey',
          body: {
            keys: ['key1', 'key2', 'key3'],
            weights: 'foo'
          }
        });

      should(() => extractArgumentsFromRequestForZInterstore(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });
    });

    it('should add weights only if the provided array is not empty', () => {
      const
        req = new Request({
          _id: 'myKey',
          body: {
            keys: ['key1', 'key2', 'key3'],
            weights: []
          }
        }),
        result = extractArgumentsFromRequestForZInterstore(req);

      should(result).have.length(5);
      should(result).eql([
        'myKey',
        3,
        'key1',
        'key2',
        'key3',
      ]);
    });


  });

  describe('#extractArgumentsFromRequestForMExecute', () => {
    beforeEach(() => {
      MemoryStorageController.__set__({mapping: origMapping});
    });

    it('should be called from extractArgumentsFromRequest when calling "mexecute"', () => {
      request.input.body.actions = [
        { 'action': 'set', 'args': { '_id': 'x', 'body': { 'value': 1 } } },
        { 'action': 'get', 'args': { '_id': 'x' } },
        { 'action': 'del', 'args': { 'body': { 'keys': ['list:a'] } } }];
      extractArgumentsFromRequest('mexecute', request);

      should(called.extractArgumentsFromRequestForMExecute.called).be.true();
      should(called.extractArgumentsFromRequestForMExecute.args).be.eql([request]);
    });

    it('should throw when there is an invalid command', () => {
      request.input.body.actions = [
        { 'action': 'set', 'args': {} }];
      should(() => extractArgumentsFromRequestForMExecute(request))
        .throw(BadRequestError, { id: 'api.assert.missing_argument' });

      request.input.body.actions = [{ 'action': 'exec', 'args': {} }];
      should(() => extractArgumentsFromRequestForMExecute(request))
        .throw(BadRequestError, { id: 'api.assert.forbidden_argument' });
    });
  });

  describe('#generated functions', () => {
    beforeEach(() => {
      MemoryStorageController.__set__({mapping: origMapping});
    });

    it('should return a valid response', () => {
      const req = new Request({
        controller: 'memoryStorage',
        action: 'set',
        _id: 'myKey',
        body: {
          value: 'bar'
        }
      });

      return msController.set(req)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.name).be.exactly('set');
          should(response.args).length(2);
          should(response.args).be.eql(['myKey', 'bar']);
        });
    });

    it('should throw if a non-skipable parameter is missing', () => {
      const req = new Request({
        controller: 'memoryStorage',
        action: 'expire',
        _id: 'myKey',
        body: {
          foo: 'bar'
          // ms:expire expects a "seconds" parameter
        }
      });

      should(() => msController.expire(req))
        .throw(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('custom mapping checks - geoadd', () => {
      const
        req = new Request({
          _id: 'myKey',
          body: {}
        });

      should(() => msController.geoadd(req))
        .throw(BadRequestError, { id: 'api.assert.missing_argument' });

      req.input.body.points = [];
      should(() => msController.geoadd(req))
        .throw(BadRequestError, { id: 'api.assert.empty_argument' });

      req.input.body.points = ['foo'];
      should(() => msController.geoadd(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_argument' });

      req.input.body.points = [{name: 'foo', lon: '13.361389'}];
      should(() => msController.geoadd(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_argument' });

      req.input.body.points = [{name: 'foo', lat: '38.115556'}];
      should(() => msController.geoadd(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_argument' });

      req.input.body.points = [{lon: '13.361389', lat: '38.115556'}];
      should(() => msController.geoadd(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_argument' });

      req.input.body.points = [{name: 'foo', lon: 'foo', lat: '38.115556'}];
      should(() => msController.geoadd(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });

      req.input.body.points = [{name: 'foo', lon: '13.361389', lat: 'bar'}];
      should(() => msController.geoadd(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });

      req.input.body.points = [
        {name: 'palermo', lon: '13.361389', lat: '38.115556'},
        {name: 'catania', lon: '15.087269', lat: '37.502669'}
      ];

      return msController.geoadd(req)
        .then(response => {
          should(response.name).be.exactly('geoadd');
          should(response.args).be.eql([
            'myKey',
            '13.361389',
            '38.115556',
            'palermo',
            '15.087269',
            '37.502669',
            'catania'
          ]);
        });
    });

    it('custom mapping checks - geohash', () => {
      const
        req = new Request({
          _id: 'myKey',
          members: ['foo', 'bar', 'baz']
        });

      return msController.geohash(req)
        .then(response => {
          should(response.name).be.exactly('geohash');
          should(response.args).be.eql(['myKey', 'foo', 'bar', 'baz']);

          req.input.args.members = 'foo,bar,baz';
          return msController.geohash(req);
        })
        .then(response => {
          should(response.name).be.exactly('geohash');
          should(response.args).be.eql(['myKey', 'foo', 'bar', 'baz']);
        });
    });

    it('custom mapping checks - georadius', () => {
      const
        req = new Request({
          _id: 'myKey',
          lon: 42,
          lat: 13,
          distance: 37,
          unit: 'km',
          options: ['withcoord', 'withdist', 'count', 25, 'asc']
        });

      return msController.georadius(req)
        .then(response => {
          should(response.name).be.exactly('georadius');
          should(response.args).be.eql(['myKey', 42, 13, 37, 'km', 'WITHCOORD', 'WITHDIST', 'COUNT', 25, 'ASC']);

          req.input.args.options = 'withcoord,withdist,count,25,asc';
          return msController.georadius(req);
        })
        .then(response => {
          should(response.name).be.exactly('georadius');
          should(response.args).be.eql(['myKey', 42, 13, 37, 'km', 'WITHCOORD', 'WITHDIST', 'COUNT', '25', 'ASC']);
        });
    });

    it('custom mapping checks - georadiusbymember', () => {
      const
        req = new Request({
          _id: 'myKey',
          member: 'foo',
          distance: 37,
          unit: 'km',
          options: ['withcoord', 'withdist', 'count', 25, 'asc']
        });

      return msController.georadiusbymember(req)
        .then(response => {
          should(response.name).be.exactly('georadiusbymember');
          should(response.args).be.eql(['myKey', 'foo', 37, 'km', 'WITHCOORD', 'WITHDIST', 'COUNT', 25, 'ASC']);

          req.input.args.options = 'withcoord,withdist,count,25,asc';
          return msController.georadiusbymember(req);
        })
        .then(response => {
          should(response.name).be.exactly('georadiusbymember');
          should(response.args).be.eql(['myKey', 'foo', 37, 'km', 'WITHCOORD', 'WITHDIST', 'COUNT', '25', 'ASC']);
        });
    });

    it('custom mapping checks - hmget', () => {
      const
        req = new Request({
          _id: 'myKey',
          fields: ['foo', 'bar', 'baz']
        });

      return msController.hmget(req)
        .then(response => {
          should(response.name).be.exactly('hmget');
          should(response.args).be.eql(['myKey', 'foo', 'bar', 'baz']);

          req.input.args.fields = 'foo,bar,baz';
          return msController.hmget(req);
        })
        .then(response => {
          should(response.name).be.exactly('hmget');
          should(response.args).be.eql(['myKey', 'foo', 'bar', 'baz']);
        });
    });

    it('custom mapping checks - hmset', () => {
      const
        req = new Request({
          _id: 'myKey',
          body: {}
        });

      should(() => msController.hmset(req))
        .throw(BadRequestError, { id: 'api.assert.missing_argument' });

      req.input.body.entries = {};
      should(() => msController.hmset(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });

      req.input.body.entries = [{field: 'foo'}];
      should(() => msController.hmset(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_argument'});

      req.input.body.entries = [{value: 'foo'}];
      should(() => msController.hmset(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_argument' });

      req.input.body.entries = [
        {field: 'foo', value: 'bar'},
        {field: 'baz', value: 'qux'}
      ];

      return msController.hmset(req)
        .then(response => {
          should(response.name).be.exactly('hmset');
          should(response.args).be.eql(['myKey', 'foo', 'bar', 'baz', 'qux']);
        });
    });

    it('custom mapping checks - mget', () => {
      const
        req = new Request({
          keys: ['foo', 'bar', 'baz']
        });

      return msController.mget(req)
        .then(response => {
          should(response.name).be.exactly('mget');
          should(response.args).be.eql([['foo', 'bar', 'baz']]);

          req.input.args.keys = 'foo,bar,baz';
          return msController.mget(req);
        })
        .then(response => {
          should(response.name).be.exactly('mget');
          should(response.args).be.eql([['foo', 'bar', 'baz']]);
        });
    });

    it('custom mapping checks - mset', () => {
      const
        req = new Request({
          body: {
          }
        });

      should(() => msController.mset(req))
        .throw(BadRequestError, { id: 'api.assert.missing_argument' });

      req.input.body.entries = {};
      should(() => msController.mset(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });

      req.input.body.entries = ['foobar'];
      should(() => msController.mset(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_argument' });

      req.input.body.entries = [{key: 'foo'}];
      should(() => msController.mset(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_argument' });

      req.input.body.entries = [{value: 'foo'}];
      should(() => msController.mset(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_argument' });

      req.input.body.entries = [
        {key: 'key1', value: 'value1'},
        {key: 'key2', value: 'value2'},
        {key: 'key3', value: 'value3'}
      ];

      return msController.mset(req)
        .then(response => {
          should(response.name).be.exactly('mset');
          should(response.args).be.eql([['key1', 'value1', 'key2', 'value2', 'key3', 'value3']]);
        });
    });

    it('custom mapping checks - scan', () => {
      const
        req = new Request({
          cursor: 0,
          match: ['foobar']
        });

      should(() => msController.scan(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });

      req.input.args.match = 'foobar';
      req.input.args.count = 'foobar';
      should(() => msController.scan(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });

      req.input.args.count = 3;

      return msController.scan(req)
        .then(response => {
          should(response.name).be.exactly('scan');
          should(response.args).be.eql([0, 'MATCH', 'foobar', 'COUNT', 3]);
        });
    });

    it('custom mapping checks - sscan', () => {
      const
        req = new Request({
          cursor: 0,
          match: ['foobar'],
          _id: 'key'
        });

      should(() => msController.sscan(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });

      req.input.args.match = 'foobar';
      req.input.args.count = 'foobar';
      should(() => msController.sscan(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_type' });

      req.input.args.count = 3;

      return msController.sscan(req)
        .then(response => {
          should(response.name).be.exactly('sscan');
          should(response.args).be.eql(['key', 0, 'MATCH', 'foobar', 'COUNT', 3]);
        });
    });

    it('custom mapping checks - sdiff', () => {
      const
        req = new Request({
          _id: 'key',
          keys: ['foo', 'bar', 'baz']
        });

      return msController.sdiff(req)
        .then(response => {
          should(response.name).be.exactly('sdiff');
          should(response.args).be.eql(['key', 'foo', 'bar', 'baz']);

          req.input.args.keys = 'foo,bar,baz';
          return msController.sdiff(req);
        })
        .then(response => {
          should(response.name).be.exactly('sdiff');
          should(response.args).be.eql(['key', 'foo', 'bar', 'baz']);
        });
    });

    it('custom mapping checks - sunion', () => {
      const
        req = new Request({
          keys: ['foo', 'bar', 'baz']
        });

      return msController.sunion(req)
        .then(response => {
          should(response.name).be.exactly('sunion');
          should(response.args).be.eql(['foo', 'bar', 'baz']);

          req.input.args.keys = 'foo,bar,baz';
          return msController.sunion(req);
        })
        .then(response => {
          should(response.name).be.exactly('sunion');
          should(response.args).be.eql(['foo', 'bar', 'baz']);
        });
    });

    it('custom mapping checks - zrange', () => {
      const
        req = new Request({
          controller: 'memoryStorage',
          action: 'zrange',
          _id: 'myKey',
          start: 'startVal',
          stop: 'stopVal',
          options: ['withscores']
        });

      return msController.zrange(req)
        .then(response => {
          should(response.name).be.exactly('zrange');
          should(response.args).be.eql(['myKey', 'startVal', 'stopVal', 'WITHSCORES']);

          req.input.args.options = 'withscores';
          return msController.zrange(req);
        })
        .then(response => {
          should(response.name).be.exactly('zrange');
          should(response.args).be.eql(['myKey', 'startVal', 'stopVal', 'WITHSCORES']);
        });
    });

    it('custom mapping checks - zrangebylex', () => {
      const
        req = new Request({
          controller: 'memoryStorage',
          action: 'zrangebylex',
          _id: 'myKey',
          min: 'minVal',
          max: 'maxVal',
          limit: [10]
        });

      should(() => msController.zrangebylex(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_argument' });
      req.input.args.limit = [10, 20];

      return msController.zrangebylex(req)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.name).be.exactly('zrangebylex');
          should(response.args).be.eql(['myKey','minVal','maxVal','LIMIT',10,20]);

          const zrevrangeRequest = new Request({
            controller: 'memoryStorage',
            action: 'zrevrangebylex',
            _id: 'myKey',
            min: 'minVal',
            max: 'maxVal',
            limit: '10'
          });

          should(() => msController.zrevrangebylex(zrevrangeRequest))
            .throw(BadRequestError, { id: 'api.assert.invalid_argument' });

          zrevrangeRequest.input.args.limit = '10,20';

          return msController.zrevrangebylex(zrevrangeRequest);
        })
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.name).be.exactly('zrevrangebylex');
          should(response.args).be.eql(['myKey','maxVal','minVal','LIMIT','10','20']);
        });
    });

    it('custom mapping checks - zrangebyscore', () => {
      const
        req = new Request({
          controller: 'memoryStorage',
          action: 'zrangebyscore',
          _id: 'myKey',
          min: 'minVal',
          max: 'maxVal',
          options: ['withscores'],
          limit: []
        }),
        expected = [
          'myKey',
          'minVal',
          'maxVal',
          'WITHSCORES',
          'LIMIT',
          10,
          20
        ];

      should(() => msController.zrangebyscore(req))
        .throw(BadRequestError, { id: 'api.assert.invalid_argument' });

      req.input.args.limit = [10, 20];

      return msController.zrangebyscore(req)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.name).be.exactly('zrangebyscore');
          should(response.args).be.eql(expected);

          const zrevrangebyscore = new Request({
            controller: 'memoryStorage',
            action: 'zrevrangebyscore',
            _id: 'myKey',
            min: 'minVal',
            max: 'maxVal',
            options: ['withscores'],
            limit: [10]
          });

          should(() => msController.zrevrangebyscore(zrevrangebyscore))
            .throw(BadRequestError, { id: 'api.assert.invalid_argument' });

          zrevrangebyscore.input.args.limit = [10, 20];

          return msController.zrevrangebyscore(zrevrangebyscore);
        })
        .then(response => {
          expected[1] = expected[2];
          expected[2] = 'minVal';

          should(response).be.instanceof(Object);
          should(response.name).be.exactly('zrevrangebyscore');
          should(response.args).be.eql(expected);
        });
    });
  });
});

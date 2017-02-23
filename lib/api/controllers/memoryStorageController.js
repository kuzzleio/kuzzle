'use strict';

const
  _ = require('lodash'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  assertHasBody = require('./util/requestAssertions').assertHasBody,
  assertBodyAttributeType = require('./util/requestAssertions').assertBodyAttributeType;

let mapping;

  /**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function MemoryStorageController (kuzzle) {
  initMapping();

  Object.keys(mapping).forEach(command => {
    this[command] = (request) => {
      return kuzzle.services.list.memoryStorage[command].apply(
        kuzzle.services.list.memoryStorage,
        extractArgumentsFromRequest(command, request)
      );
    };
  });

}

module.exports = MemoryStorageController;

function initMapping () {
  mapping = {
    append: {
      key: ['resource', '_id'],
      value: ['body', 'value']
    },
    bitcount: {
      key: ['resource', '_id'],
      start: {skip: true, path: ['args', 'start']},
      end: {skip: true, path: ['args', 'end']}
    },
    bitop: {
      operation: ['body', 'operation'],
      destkey: ['resource', '_id'],
      keys: { merge: true, path: ['body', 'keys'] }
    },
    bitpos: {
      key: ['resource', '_id'],
      bit: ['args', 'bit'],
      start: {skip: true, path : ['args', 'start']},
      end: {skip: true, path: ['args', 'end']}
    },
    dbsize: null,
    decrby: {
      key: ['resource', '_id'],
      value: ['body', 'value']
    },
    del: {
      keys: ['body', 'keys']
    },
    expire: {
      key: ['resource', '_id'],
      seconds: ['body', 'seconds']
    },
    expireat: {
      key: ['resource', '_id'],
      timestamp: ['body', 'timestamp']
    },
    flushdb: null,
    geoadd: {
      key: {path: ['resource', '_id']},
      longitude: {path: ['body', 'longitude']},
      latitude: {path: ['body', 'latitude']},
      name: {path: ['body', 'name']}
    },
    geodist: {
      key: ['resource', '_id'],
      member1: ['args', 'member1'],
      member2: ['args', 'member2'],
      unit: {skip: true, path: ['args', 'unit']}
    },
    geohash: {
      key: ['resource', '_id'],
      members: {map: val => typeof val === 'string' ? val.split(',') : val, path: ['args', 'members']}
    },
    georadius: {
      key: ['resource', '_id'],
      longitude: ['args', 'longitude'],
      latitude: ['args', 'latitude'],
      distance: ['args', 'distance'],
      unit: ['args', 'unit'],
      options: {skip: true, map: val => typeof val === 'string' ? val.split(',') : val, path: ['args', 'options']}
    },
    georadiusbymember: {
      key: ['resource', '_id'],
      member: ['args', 'member'],
      distance: ['args', 'distance'],
      unit: ['args', 'unit'],
      options: {skip: true, map: val => typeof val === 'string' ? val.split(',') : val, path: ['args', 'options']}
    },
    getbit: {
      key: ['resource', '_id'],
      offset: ['args', 'offset']
    },
    getrange: {
      key: ['resource', '_id'],
      start: ['args', 'start'],
      end: ['args', 'end']
    },
    hdel: {
      key: ['resource', '_id'],
      fields: {skip: true, merge: true, path: ['body', 'fields']}
    },
    hmget: {
      key: ['resource', '_id'],
      fields: {map: val => typeof val === 'string' ? val.split(',') : val, path: ['args', 'fields']}
    },
    hexists: {
      key: ['resource', '_id'],
      field: ['args', 'field']
    },
    hincrby: {
      key: ['resource', '_id'],
      field: ['body', 'field'],
      value: ['body', 'value']
    },
    hmset: {
      key: ['resource', '_id'],
      entries: {
        map: (val, request) => {
          assertBodyAttributeType(request, 'entries', 'array');
          return val.map(entry => [entry.field, entry.value]);
        },
        path: ['body', 'entries'],
        merge: true
      }
    },
    hset: {
      key: ['resource', '_id'],
      field: ['body', 'field'],
      value: ['body', 'value']
    },
    hstrlen: {
      key: ['resource', '_id'],
      field: ['args', 'field']
    },
    keys: {
      pattern: ['args', 'pattern']
    },
    lindex: {
      key: ['resource', '_id'],
      index: ['args', 'idx']
    },
    linsert: {
      key: ['resource', '_id'],
      position: ['body', 'position'],
      pivot: ['body', 'pivot'],
      value: ['body', 'value']
    },
    lpush: {
      key: ['resource', '_id'],
      values: {skip: true, merge: true, path: ['body', 'values']}
    },
    lrange: {
      key: ['resource', '_id'],
      start: ['args', 'start'],
      stop: ['args', 'stop']
    },
    lrem: {
      key: ['resource', '_id'],
      count: ['body', 'count'],
      value: ['body', 'value']
    },
    lset: {
      key: ['resource', '_id'],
      index: ['body', 'index'],
      value: ['body', 'value']
    },
    ltrim: {
      key: ['resource', '_id'],
      start: ['body', 'start'],
      stop: ['body', 'stop']
    },
    mget: {
      keys: {map: val => typeof val === 'string' ? val.split(',') : val, path: ['args', 'keys']}
    },
    mset: {
      entries: {
        map: (val, request) => {
          assertBodyAttributeType(request, 'entries', 'array');
          return val.map(entry => [entry.key, entry.value]);
        },
        path: ['body', 'entries'],
        merge: true
      }
    },
    object: {
      subcommand: ['args', 'subcommand'],
      key: ['resource', '_id']
    },
    pexpire: {
      key: ['resource', '_id'],
      milliseconds: ['body', 'milliseconds']
    },
    pexpireat: {
      key: ['resource', '_id'],
      timestamp: ['body', 'timestamp']
    },
    pfadd: {
      key: ['resource', '_id'],
      elements: {skip: true, merge: true, path: ['body', 'elements']}
    },
    pfmerge: {
      key: ['resource', '_id'],
      sources: {skip: true, merge: true, path: ['body', 'sources']}
    },
    ping: null,
    psetex: {
      key: ['resource', '_id'],
      milliseconds: ['body', 'milliseconds'],
      value: ['body', 'value']
    },
    randomkey: null,
    rename: {
      key: ['resource', '_id'],
      newkey: ['body', 'newkey']
    },
    renamenx: {
      key: ['resource', '_id'],
      newkey: ['body', 'newkey']
    },
    rpoplpush: {
      source: ['body', 'source'],
      destination: ['body', 'destination']
    },
    sadd: {
      key: ['resource', '_id'],
      members: {skip: true, merge: true, path: ['body', 'members']}
    },
    scan: {
      cursor: ['args', 'cursor'],
      match: {
        skip: true,
        path: ['args', 'match'],
        map: (val, request) => {
          if (typeof val !== 'string') {
            throw new BadRequestError(`ms:${request.input.action} Invalid match parameter`);
          }

          return ['MATCH', val];
        }
      },
      count: {
        skip: true,
        path: ['args', 'count'],
        map: (val, request) => {
          if (Number.isNaN(Number.parseInt(val))) {
            throw new BadRequestError(`ms:${request.input.action} Invalid count parameter`);
          }

          return ['COUNT', val];
        }
      }
    },
    sdiff: {
      key: ['resource', '_id'],
      keys: {map: val => typeof val === 'string' ? val.split(',') : val, path: ['args', 'keys']}
    },
    sdiffstore: {
      destination: ['body', 'destination'],
      key: ['resource', '_id'],
      keys: {merge: true, path: ['body', 'keys']}
    },
    set: null, // handled by extractArgumentsFromRequestForSet
    setex: {
      key: ['resource', '_id'],
      seconds: ['body', 'seconds'],
      value: ['body', 'value']
    },
    setnx: {
      key: ['resource', '_id'],
      value: ['body', 'value']
    },
    sinterstore: {
      destination: ['body', 'destination'],
      keys: {merge: true, path: ['body', 'keys']}
    },
    sismember: {
      key: ['resource', '_id'],
      member: ['args', 'member']
    },
    smove: {
      key: ['resource', '_id'],
      destination: ['body', 'destination'],
      member: ['body', 'member']
    },
    sort: null, // handled by extractArgumentsFromRequestForSort
    spop: {
      key: ['resource', '_id'],
      count: {skip: true, path: ['body', 'count']}
    },
    srandmember: {
      key: ['resource', '_id'],
      count: {skip: true, path: ['args', 'count']}
    },
    srem: {
      key: ['resource', '_id'],
      members: {skip: true, merge: true, path: ['body', 'members']}
    },
    sunion: {
      keys: {map: val => typeof val === 'string' ? val.split(',') : val, path: ['args', 'keys']}
    },
    sunionstore: {
      destination: ['body', 'destination'],
      keys: {merge: true, path: ['body', 'keys']}
    },
    time: null,
    touch: {
      keys: {merge: true, path: ['body', 'keys']}
    },
    zadd: null, // handled by extractArgumentsFromRequestForZAdd
    zcount: {
      key: ['resource', '_id'],
      min: ['args', 'min'],
      max: ['args', 'max']
    },
    zincrby: {
      key: ['resource', '_id'],
      value: ['body', 'value'],
      member: ['body', 'member']
    },
    zinterstore: null, // handled by extractArgumentsFromRequestForZInterstore
    zlexcount: {
      key: ['resource', '_id'],
      min: ['args', 'min'],
      max: ['args', 'max']
    },
    zrange: {
      key: ['resource', '_id'],
      start: ['args', 'start'],
      stop: ['args', 'stop'],
      options: {skip: true, map: val => typeof val === 'string' ? val.split(',') : val, path: ['args', 'options']}
    },
    zrangebylex: {
      key: ['resource', '_id'],
      min: ['args', 'min'],
      max: ['args', 'max'],
      limit: {
        skip: true,
        map: val => {
          let result = ['LIMIT'];

          result = result.concat(typeof val === 'string' ? val.split(',') : val);

          // "result" should contain LIMIT offset count
          if (result.length !== 3) {
            throw new BadRequestError('ms:zrangebylex Invalid limit parameter');
          }

          return result;
        },
        path: ['args', 'limit']
      }
    },
    zrangebyscore: {
      key: ['resource', '_id'],
      min: ['args', 'min'],
      max: ['args', 'max'],
      options: {skip: true, map: val => typeof val === 'string' ? val.split(',') : val, path: ['args', 'options']},
      limit: {
        skip: true,
        map: val => {
          let result = ['LIMIT'];

          result = result.concat(typeof val === 'string' ? val.split(',') : val);

          // "result" should contain LIMIT offset count
          if (result.length !== 3) {
            throw new BadRequestError('ms:zrangebylex Invalid limit parameter');
          }

          return result;
        },
        path: ['args', 'limit']
      }
    },
    zrem: {
      key: ['resource', '_id'],
      members: {merge: true, path: ['body', 'members']}
    },
    zremrangebylex: {
      key: ['resource', '_id'],
      min: ['body', 'min'],
      max: ['body', 'max']
    },
    zremrangebyrank: {
      key: ['resource', '_id'],
      min: ['body', 'start'],
      max: ['body', 'stop']
    },
    zremrangebyscore: {
      key: ['resource', '_id'],
      min: ['body', 'min'],
      max: ['body', 'max']
    },
    zrevrank: {
      key: ['resource', '_id'],
      member: ['args', 'member']
    },
    zunionstore: null // handled by extractArgumentsFromRequestForZInterstore
  };

  // unique argument key
  mapping.decr = mapping.get = mapping.exists =
    mapping.hgetall = mapping.hkeys = mapping.hlen =
    mapping.hvals = mapping.incr = mapping.llen = mapping.lpop =
    mapping.persist = mapping.pttl = mapping.rpop = mapping.scard =
    mapping.smembers = mapping.strlen = mapping.ttl =
    mapping.type = mapping.zcard = { key: ['resource', '_id'] };

  // key value
  mapping.getset = mapping.lpushx = mapping.rpushx = {
    key: ['resource', '_id'],
    value: ['body', 'value']
  };

  mapping.pfcount = mapping.sinter = mapping.mget;

  mapping.incrby = mapping.incrbyfloat = mapping.decrby;
  mapping.geopos = mapping.geohash;
  mapping.hget = mapping.hexists;
  mapping.hsetnx = mapping.hset;
  mapping.msetnx = mapping.mset;
  mapping.rpush = mapping.lpush;
  mapping.hincrbyfloat = mapping.hincrby;
  mapping.zrevrange = mapping.zrange;
  mapping.zscore = mapping.zrank = mapping.zrevrank;
  mapping.zrevrangebylex = mapping.zrangebylex;
  mapping.zrevrangebyscore = mapping.zrangebyscore;
  mapping.hscan = mapping.sscan = mapping.zscan = mapping.scan;
}

/**
 * @param {string} command
 * @param {Request} request
 * @returns {*}
 */
function extractArgumentsFromRequest (command, request) {
  let args = [];

  // Dealing with exceptions
  if (command === 'set') {
    return extractArgumentsFromRequestForSet(request);
  }
  if (command === 'sort') {
    return extractArgumentsFromRequestForSort(request);
  }
  if (command === 'zadd') {
    return extractArgumentsFromRequestForZAdd(request);
  }
  if (command === 'zinterstore') {
    return extractArgumentsFromRequestForZInterstore(request);
  }
  if (command === 'zunionstore') {
    return extractArgumentsFromRequestForZInterstore(request);
  }

  if (!mapping[command]) {
    return [];
  }

  if (!request.input.body) {
    request.input.body = {};
  }

  Object.keys(mapping[command]).forEach(key => {
    let
      data = mapping[command][key],
      path = _.isArray(data) ? data : data.path,
      toMerge = !_.isArray(data) && data.merge === true,
      map = !_.isArray(data) && data.map,
      skip = !_.isArray(data) && data.skip === true,
      value;

    value = path.reduce((previousValue, currentValue, currentIndex, array) => {
      if (previousValue[array[currentIndex]] !== undefined && previousValue[array[currentIndex]] !== null) {
        return previousValue[array[currentIndex]];
      }
      return undefined;
    }, request.input);

    if (value === undefined) {
      if (skip) {
        return;
      }

      throw new BadRequestError(`ms:${command} Missing argument ${key}`)
    }

    if (map) {
      value = data.map(value, request);
    }

    if (toMerge && _.isArray(value)) {
      args = args.concat(value);
    } else if (value !== undefined) {
      args.push(value);
    }
  });
  console.log('=======', args);
  return args;
}

/**
 * @param {Request} request
 * @returns {*[]}
 */
function extractArgumentsFromRequestForSet (request) {
  let args = [request.input.resource._id];

  assertHasBody(request);
  assertBodyAttributeType(request, 'value', 'string');

  args.push(request.input.body.value);

  if (request.input.body.ex !== undefined) {
    args = args.concat(['EX', request.input.body.ex]);
  }

  if (request.input.body.px !== undefined) {
    args = args.concat(['PX', request.input.body.px]);
  }

  if (request.input.body.ex && request.input.body.px) {
    throw new BadRequestError('ms:set EX and PX options are mutually exclusive');
  }

  if (request.input.body.nx) {
    args.push('NX');
  }

  if (request.input.body.xx) {
    args.push('XX');
  }

  if (request.input.body.nx && request.input.body.xx) {
    throw new BadRequestError('ms:set NX and XX options are mutually exclusive');
  }

  return args;
}

/**
 * @param {Request} request
 * @returns {*[]}
 */
function extractArgumentsFromRequestForSort (request) {
  let args = [request.input.resource._id];

  if (request.input.body) {
    if (request.input.body.alpha) {
      args.push('ALPHA');
    }

    if (request.input.body.direction !== undefined) {
      const direction = request.input.body.direction.toUpperCase();

      if (['ASC', 'DESC'].indexOf(direction) === -1) {
        throw new BadRequestError('ms:sort Invalid direction argument (expected: ASC or DESC)');
      }

      args.push(direction);
    }

    if (request.input.body.by !== undefined) {
      args = args.concat(['BY', request.input.body.by]);
    }

    if (request.input.body.limit !== undefined) {
      assertBodyAttributeType(request, 'limit', 'object');
      if (!Number.isInteger(request.input.body.limit.count) || !Number.isInteger(request.input.body.limit.offset)) {
        throw new BadRequestError('ms:sort Invalid "limit" option content');
      }

      args = args.concat(['LIMIT', request.input.body.limit.offset, request.input.body.limit.count]);
    }

    if (request.input.body.get !== undefined) {
      assertBodyAttributeType(request, 'get', 'array');

      args = args.concat(request.input.body.get.map(pattern => ['GET', pattern]));
    }

    if (request.input.body.store !== undefined) {
      args = args.concat(['STORE', request.input.body.store]);
    }
  }

  return args;
}

/**
 * @param {Request} request
 * @returns {*[]}
 */
function extractArgumentsFromRequestForZAdd (request) {
  let args = [request.input.resource._id];

  assertHasBody(request);
  assertBodyAttributeType(request, 'elements', 'array');

  if (!request.input.resource._id) {
    throw new BadRequestError('ms:zadd Missing destination key');
  }

  if (request.input.body.nx) {
    args.push('NX');
  }
  else if (request.input.body.xx) {
    args.push('XX');
  }

  if (request.input.body.nx && request.input.body.xx){
    throw new BadRequestError('ms:zadd NX and XX options are mutually exclusive');
  }

  if (request.input.body.ch) {
    args.push('CH');
  }

  if (request.input.body.incr) {
    args.push('INCR');
  }

  if (request.input.body.elements.length === 0) {
    throw new BadRequestError('ms:zadd At least 1 score/member pair must be provided');
  }
  else if (request.input.body.incr && request.input.body.elements.length > 1) {
    throw new BadRequestError('ms:zadd No more than 1 score/member pair can be specified when the "incr" option is set');
  }

  request.input.body.elements.forEach(element => {
    if (typeof element !== 'object' || Array.isArray(element) || Number.isNaN(Number.parseFloat(element.score)) || !element.member) {
      throw new BadRequestError('ms:zadd Invalid score/member pair argument');
    }

    args.push(element.score);
    args.push(element.member);
  });

  return args;
}

/**
 * @param {Request} request
 * @returns {*[]}
 */
function extractArgumentsFromRequestForZInterstore (request) {
  let args = [request.input.resource._id];

  assertHasBody(request);
  assertBodyAttributeType(request, 'keys', 'array');

  if (!request.input.resource._id) {
    throw new BadRequestError(`ms:${request.input.action} Missing destination key`);
  }

  if (request.input.body.keys.length === 0) {
    throw new BadRequestError(`ms:${request.input.action} At least 1 source key must be provided`);
  }

  args.push(request.input.body.keys.length);
  args = args.concat(request.input.body.keys);

  if (request.input.body.weights) {
    assertBodyAttributeType(request, 'weights', 'array');

    if (request.input.body.weights.length.length > 0) {
      args.push('WEIGHTS');
      args = args.concat(request.input.body.weights);
    }
  }

  if (request.input.body.aggregate) {
    assertBodyAttributeType(request, 'aggregate', 'string');

    let aggregate = request.input.body.aggregate.toUpperCase();

    if (['SUM', 'MIN', 'MAX'].indexOf(aggregate) === -1) {
      throw new BadRequestError(`ms:${request.input.action} Invalid aggregate parameter`);
    }

    args = args.concat(['AGGREGATE', aggregate]);
  }

  return args;
}

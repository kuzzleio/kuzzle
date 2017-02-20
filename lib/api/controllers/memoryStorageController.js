'use strict';

const
  _ = require('lodash'),
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
      key: { skip: true, path: ['resource', '_id'] },
      keys: { skip: true, path: ['body', 'keys'] }
    },
    exists: {
      key: { skip: true, path: ['resource', '_id'] },
      keys: { skipIfNotFoud: true, path: ['body', 'keys'] }
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
      key: {skip: true, path: ['resource', '_id']},
      longitude: {skip: true, path: ['body', 'longitude']},
      latitude: {skip: true, path: ['body', 'latitude']},
      points: {skip: true, merge: true, path: ['body', 'points']},
      name: ['body', 'name']
    },
    geodist: {
      key: ['resource', '_id'],
      member1: ['args', 'member1'],
      member2: ['args', 'member2'],
      unit: {skip: true, path: ['args', 'unit']}
    },
    geohash: {
      key: ['resource', '_id'],
      members: {merge: true, path: ['args', 'members']}
    },
    georadius: {
      key: ['resource', '_id'],
      longitude: ['args', 'longitude'],
      latitude: ['args', 'latitude'],
      distance: ['args', 'distance'],
      unit: ['args', 'unit'],
      withdist: {skip: true, path: ['args', 'withdist']},
      withcoord: {skip: true, path: ['args', 'withcoord']}
    },
    georadiusbymember: {
      key: ['resource', '_id'],
      member: ['args', 'member'],
      distance: ['args', 'distance'],
      unit: ['args', 'unit'],
      withdist: {skip: true, path: ['args', 'withdist']},
      withcoord: {skip: true, path: ['args', 'withcoord']}
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
      field: {skip: true, path: ['body', 'field']},
      fields: {skip: true, merge: true, path: ['body', 'fields']}
    },
    hmget: {
      key: ['resource', '_id'],
      field: {skip: true, path: ['args', 'field']},
      fields: {skip: true, merge: true, path: ['args', 'fields']}
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
      field: {skip: true, path: ['body', 'field']},
      value: {skip: true, path:['body', 'value']},
      values: {skip: true, merge: true, path: ['body', 'values']}
    },
    hset: {
      key: ['resource', '_id'],
      field: ['body', 'field'],
      value: ['body', 'value']
    },
    info: {
      section: {skip: true, path: ['args', 'section']}
    },
    keys: {
      pattern: ['args', 'pattern']
    },
    lastsave: null,
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
      value: {skip: true, path: ['body', 'value']},
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
      index: ['body', 'idx'],
      value: ['body', 'value']
    },
    ltrim: {
      key: ['resource', '_id'],
      start: ['body', 'start'],
      stop: ['body', 'stop']
    },
    mset: {
      key: {skip: true, path: ['resource', '_id']},
      value: {skip: true, path: ['body', 'value']},
      values: {skip: true, merge: true, path: ['body', 'values']}
    },
    object: {
      subcommand: ['args', 'subcommand'],
      args: {merge: true, path: ['args', 'args']}
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
      element: {skip: true, path: ['body', 'element']},
      elements: {skip: true, merge: true, path: ['body', 'elements']}
    },
    pfmerge: {
      destkey: ['body', 'destkey'],
      sourcekey: {skip: true, path: ['body', 'sourcekey']},
      sourcekeys: {skip: true, merge: true, path: ['body', 'sourcekeys']}
    },
    ping: null,
    psetex: {
      key: ['resource', '_id'],
      milliseconds: ['body', 'milliseconds'],
      value: ['body', 'value']
    },
    publish: {
      channel: ['body', 'channel'],
      message: ['body', 'message']
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
    restore: {
      key: ['resource', '_id'],
      ttl: ['body', 'ttl'],
      content: ['body', 'content']
    },
    rpoplpush: {
      source: ['body', 'source'],
      destination: ['body', 'destination']
    },
    sadd: {
      key: ['resource', '_id'],
      member: {skip: true, path: ['body', 'member']},
      members: {skip: true, merge: true, path: ['body', 'members']}
    },
    save: null,
    sdiffstore: {
      destination: ['body', 'destination'],
      key: {skip: true, path: ['resource', '_id']},
      keys: {skip: true, merge: true, path: ['body', 'keys']}
    },
    set: {
      key: ['resource', '_id'],
      value: ['body', 'value'],
      ex: {skip: true, path: ['body', 'ex']}
    },
    setbit: {
      key: ['resource', '_id'],
      offset: ['body', 'offset'],
      value: ['body', 'value']
    },
    setex: {
      key: ['resource', '_id'],
      seconds: ['body', 'seconds'],
      value: ['body', 'value']
    },
    setrange: {
      key: ['resource', '_id'],
      offset: ['body', 'offset'],
      value: ['body', 'value']
    },
    sinterstore: {
      destination: ['body', 'destination'],
      key: {skip: true, path: ['resource', '_id']},
      keys: {skip: true, merge: true, path: ['body', 'keys']}
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
    sort: {},
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
      member: {skip: true, path: ['body', 'member']},
      members: {skip: true, merge: true, path: ['body', 'members']}
    },
    sunionstore: {
      destination: ['body', 'destination'],
      key: {skip: true, path: ['resource', '_id']},
      keys: {skip: true, merge: true, path: ['body', 'keys']}
    },
    time: null,
    wait: {
      numslaves: ['body', 'numslaves'],
      timeout: ['body', 'timeout']
    },
    zadd: {},
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
    zinterstore: {},
    zlexcount: {
      key: ['resource', '_id'],
      min: ['args', 'min'],
      max: ['args', 'max']
    },
    zrange: {
      key: ['resource', '_id'],
      start: ['args', 'start'],
      stop: ['args', 'stop'],
      withscores: { skip: true, map: val => val ? 'WITHSCORES' : undefined, path: ['args', 'withscores'] }
    },
    zrangebylex: {
      key: ['resource', '_id'],
      min: ['args', 'min'],
      max: ['args', 'max'],
      offset: { skip: true, merge: true, map: (offset) => { return ['LIMIT', offset]; }, path: ['args', 'offset'] },
      count: { skip: true, path: ['args', 'count'] }
    },
    zrangebyscore: {
      key: ['resource', '_id'],
      min: ['args', 'min'],
      max: ['args', 'max'],
      withscores: { skip: true, map: val => val ? 'WITHSCORES' : undefined, path: ['args', 'withscores'] },
      offset: { skip: true, merge: true, map: (offset) => { return ['LIMIT', offset]; }, path: ['args', 'offset'] },
      count: { skip: true, path: ['args', 'count'] }
    },
    zrem: {
      key: ['resource', '_id'],
      member: ['body', 'member']
    },
    zremrangebylex: {
      key: ['resource', '_id'],
      min: ['body', 'min'],
      max: ['body', 'max']
    },
    zremrangebyscore: {
      key: ['resource', '_id'],
      min: ['body', 'min'],
      max: ['body', 'max']
    },
    zrevrangebylex: {
      key: ['resource', '_id'],
      max: ['args', 'max'],
      min: ['args', 'min'],
      offset: { skip: true, merge: true, map: (offset) => { return ['LIMIT', offset]; }, path: ['args', 'offset'] },
      count: { skip: true, path: ['args', 'count'] }
    },
    zrevrangebyscore: {
      key: ['resource', '_id'],
      max: ['args', 'max'],
      min: ['args', 'min'],
      withscores: { skip: true, map: val => val ? 'WITHSCORES' : undefined, path: ['args', 'withscores'] },
      offset: { skip: true, merge: true, map: (offset) => { return ['LIMIT', offset]; }, path: ['args', 'offset'] },
      count: { skip: true, path: ['args', 'count'] }
    },
    zrevrank: {
      key: ['resource', '_id'],
      member: ['args', 'member']
    },
    zunionstore: {}
  };

  // unique argument key
  mapping.decr = mapping.get = mapping.dump = mapping.hgetall = mapping.hkeys = mapping.hlen = mapping.hstrlen = mapping.hvals = mapping.incr = mapping.llen = mapping.lpop = mapping.persist = mapping.pttl = mapping.rpop = mapping.scard = mapping.smembers = mapping.strlen = mapping.ttl = mapping.type = mapping.zcard = { key: ['resource', '_id'] };

  // key value
  mapping.getset = mapping.lpushx = {
    key: ['resource', '_id'],
    value: ['body', 'value']
  };

  // key key...
  mapping.del = mapping.sunion = {
    key: {skip: true, path: ['resource', '_id'] },
    keys: {skip: true, merge: true, path: ['body', 'keys']}
  };

  mapping.exists = mapping.mget = mapping.pfcount = mapping.sdiff = mapping.sinter = {
    key: {skip: true, path: ['resource', '_id'] },
    keys: {skip: true, merge: true, path: ['args', 'keys']}
  };

  mapping.incrby = mapping.incrbyfloat = mapping.decrby;
  mapping.geopos = mapping.geohash;
  mapping.hget = mapping.hexists;
  mapping.hsetnx = mapping.hset;
  mapping.msetnx = mapping.mset;
  mapping.rpush = mapping.lpush;
  mapping.hincrbyfloat = mapping.hincrby;
  mapping.zrevrange = mapping.zrange;
  mapping.zscore = mapping.zrank = mapping.zrevrank;
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
      toMerge = !_.isArray(data) && data.merge,
      map = !_.isArray(data) && data.map,
      skip = !_.isArray(data) && data.skip,
      value;

    value = path.reduce((previousValue, currentValue, currentIndex, array) => {
      if (previousValue[array[currentIndex]] !== undefined && previousValue[array[currentIndex]] !== null) {
        return previousValue[array[currentIndex]];
      }
      return undefined;
    }, request.input);

    if (skip && value === undefined) {
      return;
    }

    if (map) {
      value = data.map(value);
    }

    if (toMerge && _.isArray(value)) {
      args = args.concat(value);
    } else {
      args.push(value);
    }
  });

  return args;
}

/**
 * @param {Request} request
 * @returns {*[]}
 */
function extractArgumentsFromRequestForSet (request) {
  let
    args = [request.input.resource._id],
    ex,
    px,
    nx,
    xx;

  assertHasBody(request);

  if (request.input.body.ex !== undefined) {
    ex = request.input.body.ex;
  }

  if (request.input.body.px !== undefined) {
    px = request.input.body.px;
    ex = undefined;
  }

  if (request.input.body.nx !== undefined) {
    nx = request.input.body.nx;
  }

  if (request.input.body.xx !== undefined) {
    xx = request.input.body.px;
  }


  if (request.input.body.value === undefined && ex === undefined && px === undefined && nx === undefined && xx === undefined) {
    // it looks like the request body is the value to set.
    args.push(request.input.body);
  }
  else {
    args.push(request.input.body.value);
  }

  if (ex) {
    args = args.concat(['EX', ex]);
  }
  if (px) {
    args = args.concat(['PS', px]);
  }
  if (nx) {
    args.push('NX');
  }
  if (xx) {
    args.push('XX');
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
    if (request.input.body.alpha === true) {
      args.push('ALPHA');
    }

    if (request.input.body.direction !== undefined) {
      args.push(request.input.body.direction.toUpperCase());
    }

    if (request.input.body.by !== undefined) {
      args = args.concat(['BY', request.input.body.by]);
    }

    if (request.input.body.count !== undefined) {
      args = args.concat([
        'LIMIT',
        request.input.body.offset !== undefined ? request.input.body.offset : 0,
        request.input.body.count
      ]);
    }

    if (request.input.body.get !== undefined) {
      args = args.concat(['GET', request.input.body.get]);
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

  if (request.input.body.nx === true) {
    args.push('NX');
  }
  else if (request.input.body.xx === true) {
    args.push('XX');
  }

  if (request.input.body.ch === true) {
    args.push('CH');
  }

  if (request.input.body.incr === true) {
    args.push('INCR');
  }

  if (request.input.body.score !== undefined) {
    args.push(request.input.body.score);
    args.push(request.input.body.member);
  }

  if (_.isArray(request.input.body.values)) {
    args = args.concat(request.input.body.values.reduce((prev, curr) => {
      return prev.concat([curr.score, curr.member]);
    }, []));
  }

  return args;
}

/**
 * @param {Request} request
 * @returns {*[]}
 */
function extractArgumentsFromRequestForZInterstore (request) {
  let args = [
      request.input.body.destination
    ],
    keys = [];

  assertHasBody(request);

  if (request.input.resource._id) {
    keys.push(request.input.resource._id);
  }

  if (request.input.body.keys !== undefined) {
    assertBodyAttributeType(request, 'keys', 'array');

    keys = keys.concat(request.input.body.keys);
  }

  args.push(keys.length);
  args = args.concat(keys);

  if (request.input.body.weights !== undefined || request.input.body.weight !== undefined) {
    args.push('WEIGHTS');

    if (request.input.body.weight !== undefined) {
      args.push(request.input.body.weight);
    }

    if (request.input.body.weights !== undefined) {
      assertBodyAttributeType(request, 'weights', 'array');

      args = args.concat(request.input.body.weights);
    }
  }

  if (request.input.body.aggregate !== undefined) {
    args = args.concat(['AGGREGATE', request.input.body.aggregate.toUpperCase()]);
  }

  return args;
}

/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  BaseController = require('./controller'),
  kassert = require('../../util/requestAssertions'),
  errorsManager = require('../../config/error-codes/throw.js');

let mapping;

/**
 * @class MemoryStorageController
 * @param {Kuzzle} kuzzle
 */
class MemoryStorageController extends BaseController {
  constructor(kuzzle) {
    super(kuzzle);

    initMapping();

    const largeCommands = [
      'mset', 'mget', 'msetnx'
    ];

    Object.keys(mapping).forEach(command => {
      this.actions.add(command);

      this[command] = request => {
        const args = extractArgumentsFromRequest(command, request);

        if (largeCommands.indexOf(command) !== -1) {
          return kuzzle.services.list.memoryStorage[command](args);
        }

        return kuzzle.services.list.memoryStorage[command](...args);
      };
    });
    this.subdomain = 'memory_storage';
  }
}

module.exports = MemoryStorageController;

const scanMatchProperty = {
  skip: true,
  merge: true,
  path: ['args', 'match'],
  map: val => {
    if (typeof val !== 'string') {
      errorsManager.throw('api', 'memory_storage', 'match_parameter');
    }

    return ['MATCH', val];
  }
};

const scanCountProperty = {
  skip: true,
  merge: true,
  path: ['args', 'count'],
  map: (val, request) => {
    assertInt(request, 'count', val);
    return ['COUNT', val];
  }
};

const zrangebyscoreOptionsProperty = {
  skip: true,
  merge: true,
  map: val => {
    const result = typeof val === 'string' ? val.split(',') : val;

    return result.map(v => typeof v === 'string' ? v.toUpperCase() : v);
  },
  path: ['args', 'options']
};

const zrangebyscoreLimitProperty = {
  skip: true,
  merge: true,
  map: val => {
    let result = ['LIMIT'];

    result = result.concat(typeof val === 'string' ? val.split(',') : val);

    // "result" should contain LIMIT offset count
    if (result.length !== 3) {
      errorsManager.throw('api', 'memory_storage', 'limit_parameter');
    }

    return result;
  },
  path: ['args', 'limit']
};

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
      points: {
        map: (val, request) => {
          const result = [];

          kassert.assertBodyAttributeType(request, 'points', 'array');

          if (val.length === 0) {
            errorsManager.throw(
              'api',
              'memory_storage',
              'add_empty_points_list'
            );
          }

          val.forEach(v => {
            if (typeof v !== 'object' || !v.lon || !v.lat || !v.name) {
              errorsManager.throw(
                'api',
                'memory_storage',
                'points_parameter'
              );
            }

            assertFloat(request, 'lon', v.lon);
            assertFloat(request, 'lat', v.lat);

            result.push(v.lon, v.lat, v.name);
          });

          return result;
        },
        path: ['body', 'points'],
        merge: true
      }
    },
    geodist: {
      key: ['resource', '_id'],
      member1: ['args', 'member1'],
      member2: ['args', 'member2'],
      unit: {skip: true, path: ['args', 'unit']}
    },
    geohash: {
      key: ['resource', '_id'],
      members: {
        merge: true,
        map: val => typeof val === 'string' ? val.split(',') : val,
        path: ['args', 'members']
      }
    },
    georadius: {
      key: ['resource', '_id'],
      lon: ['args', 'lon'],
      lat: ['args', 'lat'],
      distance: ['args', 'distance'],
      unit: ['args', 'unit'],
      options: {
        skip: true,
        merge: true,
        map: val => {
          const result = typeof val === 'string' ? val.split(',') : val;

          return result.map(v => typeof v === 'string' ? v.toUpperCase() : v);
        },
        path: ['args', 'options']
      }
    },
    georadiusbymember: {
      key: ['resource', '_id'],
      member: ['args', 'member'],
      distance: ['args', 'distance'],
      unit: ['args', 'unit'],
      options: {
        skip: true,
        merge: true,
        map: val => {
          const result = typeof val === 'string' ? val.split(',') : val;

          return result.map(v => typeof v === 'string' ? v.toUpperCase() : v);
        },
        path: ['args', 'options']
      }
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
      fields: {
        merge: true,
        map: val => typeof val === 'string' ? val.split(',') : val,
        path: ['args', 'fields']
      }
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
          const result = [];

          kassert.assertBodyAttributeType(request, 'entries', 'array');
          val.forEach(v => {
            if (typeof v !== 'object' || !v.field || !v.value) {
              errorsManager.throw('api', 'memory_storage', 'entries_parameter');
            }

            result.push(v.field, v.value);
          });

          return result;
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
      keys: {
        merge: true,
        map: val => typeof val === 'string' ? val.split(',') : val,
        path: ['args', 'keys']
      }
    },
    mset: {
      entries: {
        map: (val, request) => {
          const result = [];

          kassert.assertBodyAttributeType(request, 'entries', 'array');
          val.forEach(entry => {
            if (typeof entry !== 'object' || !entry.key || !entry.value) {
              errorsManager.throw('api', 'memory_storage', 'entries_parameter');
            }

            result.push(entry.key, entry.value);
          });

          return result;
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
      match: scanMatchProperty,
      count: scanCountProperty
    },
    sdiff: {
      key: ['resource', '_id'],
      keys: {
        merge: true,
        map: val => typeof val === 'string' ? val.split(',') : val,
        path: ['args', 'keys']
      }
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
    sscan: {
      key: ['resource', '_id'],
      cursor: ['args', 'cursor'],
      match: scanMatchProperty,
      count: scanCountProperty
    },
    sunion: {
      keys: {
        merge: true,
        map: val => typeof val === 'string' ? val.split(',') : val,
        path: ['args', 'keys']
      }
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
      options: {
        skip: true,
        merge: true,
        map: val => {
          const result = typeof val === 'string' ? val.split(',') : val;

          return result.map(v => typeof v === 'string' ? v.toUpperCase() : v);
        },
        path: ['args', 'options']}
    },
    zrangebylex: {
      key: ['resource', '_id'],
      min: ['args', 'min'],
      max: ['args', 'max'],
      limit: {
        skip: true,
        merge: true,
        map: val => {
          let result = ['LIMIT'];

          result = result.concat(typeof val === 'string' ? val.split(',') : val);

          // "result" should contain LIMIT offset count
          if (result.length !== 3) {
            errorsManager.throw('api', 'memory_storage', 'limit_parameter');
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
      options: zrangebyscoreOptionsProperty,
      limit: zrangebyscoreLimitProperty
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
    zrevrangebylex: {
      key: ['resource', '_id'],
      max: ['args', 'max'],
      min: ['args', 'min'],
      limit: {
        skip: true,
        merge: true,
        map: val => {
          let result = ['LIMIT'];

          result = result.concat(typeof val === 'string' ? val.split(',') : val);

          // "result" should contain LIMIT offset count
          if (result.length !== 3) {
            errorsManager.throw('api', 'memory_storage', 'limit_parameter');
          }

          return result;
        },
        path: ['args', 'limit']
      }
    },
    zrevrangebyscore: {
      key: ['resource', '_id'],
      max: ['args', 'max'],
      min: ['args', 'min'],
      options: zrangebyscoreOptionsProperty,
      limit: zrangebyscoreLimitProperty
    },
    zrevrank: {
      key: ['resource', '_id'],
      member: ['args', 'member']
    },
    zunionstore: null // handled by extractArgumentsFromRequestForZInterstore
  };

  // unique argument key
  mapping.decr = mapping.get = mapping.hgetall = mapping.hkeys =
    mapping.hlen = mapping.hvals = mapping.incr = mapping.llen =
    mapping.lpop = mapping.persist = mapping.pttl = mapping.rpop =
    mapping.scard = mapping.smembers = mapping.strlen = mapping.ttl =
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
  mapping.hscan = mapping.zscan = mapping.sscan;
  mapping.exists = mapping.mget;
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
    const
      data = mapping[command][key],
      path = Array.isArray(data) ? data : data.path,
      toMerge = !Array.isArray(data) && data.merge === true,
      map = !Array.isArray(data) && data.map,
      skip = !Array.isArray(data) && data.skip === true;

    let value = path.reduce(
      (previousValue, currentValue, currentIndex, array) => {
        if (previousValue[array[currentIndex]]
        !== undefined
        && previousValue[array[currentIndex]]
        !== null
        ) {
          return previousValue[array[currentIndex]];
        }
        return undefined;
      }, request.input);

    if (value === undefined) {
      if (skip) {
        return;
      }
      errorsManager.throw('api', 'memory_storage', 'missing_argument', key);
    }

    if (map) {
      value = data.map(value, request);
    }

    if (value !== undefined) {
      if (toMerge && Array.isArray(value)) {
        args = args.concat(value);
      }
      else {
        args.push(value);
      }
    }
  });

  return args;
}

/**
 * @param {Request} request
 * @returns {*[]}
 */
function extractArgumentsFromRequestForSet (request) {
  const args = [request.input.resource._id];

  kassert.assertHasId(request);
  kassert.assertHasBody(request);

  if (['undefined', 'boolean', 'object'].indexOf(typeof request.input.body.value) !== -1) {
    errorsManager.throw('api', 'memory_storage', 'non_scalar_value');
  }

  if (request.input.body.nx && request.input.body.xx) {
    errorsManager.throw('api', 'memory_storage', 'nx_xx_exclusive_opts');
  }

  if (request.input.body.ex && request.input.body.px) {
    errorsManager.throw('api', 'memory_storage', 'ex_px_exclusive_opts');
  }

  args.push(request.input.body.value);

  if (request.input.body.ex !== undefined) {
    args.push('EX', request.input.body.ex);
  }

  if (request.input.body.px !== undefined) {
    args.push('PX', request.input.body.px);
  }

  if (request.input.body.nx) {
    args.push('NX');
  }

  if (request.input.body.xx) {
    args.push('XX');
  }

  return args;
}

/**
 * @param {Request} request
 * @returns {*[]}
 */
function extractArgumentsFromRequestForSort (request) {
  const args = [request.input.resource._id];

  kassert.assertHasId(request);

  if (request.input.body) {
    if (request.input.body.alpha) {
      args.push('ALPHA');
    }

    if (request.input.body.direction !== undefined) {
      const direction = request.input.body.direction.toUpperCase();

      if (['ASC', 'DESC'].indexOf(direction) === -1) {
        errorsManager.throw('api', 'memory_storage', 'direction_argument');
      }

      args.push(direction);
    }

    if (request.input.body.by !== undefined) {
      args.push('BY', request.input.body.by);
    }

    if (request.input.body.limit !== undefined) {
      kassert.assertBodyAttributeType(request, 'limit', 'array');
      assertInt(request, 'limit.offset', request.input.body.limit[0]);
      assertInt(request, 'limit.count', request.input.body.limit[1]);

      args.push(
        'LIMIT',
        request.input.body.limit[0],
        request.input.body.limit[1]
      );
    }

    if (request.input.body.get !== undefined) {
      kassert.assertBodyAttributeType(request, 'get', 'array');

      request.input.body.get.forEach(pattern => {
        args.push('GET');
        args.push(pattern);
      });
    }

    if (request.input.body.store !== undefined) {
      args.push('STORE', request.input.body.store);
    }
  }

  return args;
}

/**
 * @param {Request} request
 * @returns {*[]}
 */
function extractArgumentsFromRequestForZAdd (request) {
  const args = [request.input.resource._id];

  kassert.assertHasId(request);
  kassert.assertHasBody(request);
  kassert.assertBodyAttributeType(request, 'elements', 'array');

  if (request.input.body.nx && request.input.body.xx) {
    errorsManager.throw('api', 'memory_storage', 'nx_xx_exclusive_opts');
  }

  if (request.input.body.nx) {
    args.push('NX');
  }

  if (request.input.body.xx) {
    args.push('XX');
  }

  if (request.input.body.ch) {
    args.push('CH');
  }

  if (request.input.body.incr) {
    args.push('INCR');
  }

  if (request.input.body.elements.length === 0) {
    errorsManager.throw('api', 'memory_storage', 'no_score_member_pair');
  }

  if (request.input.body.incr && request.input.body.elements.length > 1) {

    errorsManager.throw('api', 'memory_storage', 'too_many_score_member_pairs');
  }

  request.input.body.elements.forEach(element => {
    if (
      typeof element
      !== 'object'
      || Array.isArray(element)
      || !element.member
    ) {
      errorsManager.throw(
        'api',
        'memory_storage',
        'invalid_score_member_pair'
      );
    }

    assertFloat(request, 'score', element.score);

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

  kassert.assertHasId(request);
  kassert.assertHasBody(request);
  kassert.assertBodyAttributeType(request, 'keys', 'array');

  if (request.input.body.keys.length === 0) {
    errorsManager.throw('api', 'memory_storage', 'no_source_key');
  }

  args.push(request.input.body.keys.length);
  args = args.concat(request.input.body.keys);

  if (request.input.body.weights) {
    kassert.assertBodyAttributeType(request, 'weights', 'array');

    if (request.input.body.weights.length > 0) {
      args.push('WEIGHTS');
      args = args.concat(request.input.body.weights);
    }
  }

  if (request.input.body.aggregate) {
    kassert.assertBodyAttributeType(request, 'aggregate', 'string');

    const aggregate = request.input.body.aggregate.toUpperCase();

    if (['SUM', 'MIN', 'MAX'].indexOf(aggregate) === -1) {
      errorsManager.throw('api', 'memory_storage', 'aggregate_parameter');
    }

    args.push('AGGREGATE', aggregate);
  }

  return args;
}

/**
 * Throws with a standardized error message if "value"
 * is not a float
 *
 * @param {Request} request
 * @param {string} name of the tested parameter
 * @param {*} value of the tested parameter
 * @throws
 */
function assertFloat(request, name, value) {
  // Number.parseXxx computes the 1st member of an array if one is provided
  if (Array.isArray(value) || Number.isNaN(Number.parseFloat(value))) {
    errorsManager.throw('api', 'memory_storage', 'float_expected', name);
  }
}

/**
 * Throws with a standardized error message if "value"
 * is not an integer
 *
 * @param {Request} request
 * @param {string} name of the tested parameter
 * @param {*} value of the tested parameter
 * @throws
 */
function assertInt(request, name, value) {
  // Number.parseXxx computes the 1st member of an array if one is provided
  if (Array.isArray(value) || Number.isNaN(Number.parseInt(value))) {
    errorsManager.throw('api', 'memory_storage', 'integer_expected', name);
  }
}

/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

/* eslint sort-keys: 0 */

"use strict";

const kerror = require("../../kerror").wrap("api", "assert");

const { Request } = require("../request");
const { NativeController } = require("./baseController");
const kassert = require("../../util/requestAssertions");
const { isPlainObject, has } = require("../../util/safeObject");

let mapping;

/**
 * @class MemoryStorageController
 */
class MemoryStorageController extends NativeController {
  constructor() {
    super();

    initMapping();

    const buildCommandFn = (command) => {
      if (command === "mexecute") {
        return async (request) =>
          global.kuzzle.ask(
            "core:cache:public:mExecute",
            extractArgumentsFromRequest(command, request)
          );
      }

      const largeCommands = ["mset", "mget", "msetnx"];

      if (largeCommands.includes(command)) {
        return async (request) =>
          global.kuzzle.ask(
            "core:cache:public:execute",
            command,
            extractArgumentsFromRequest(command, request)
          );
      }

      return async (request) =>
        global.kuzzle.ask(
          "core:cache:public:execute",
          command,
          ...extractArgumentsFromRequest(command, request)
        );
    };

    for (const command of Object.keys(mapping)) {
      this._actions.add(command);
      this[command] = buildCommandFn(command);
    }
  }
}

module.exports = MemoryStorageController;

const scanMatchProperty = {
  skip: true,
  merge: true,
  path: ["args", "match"],
  map: (val) => {
    if (typeof val !== "string") {
      throw kerror.get("invalid_type", "match", "<string>");
    }

    return ["MATCH", val];
  },
};

const scanCountProperty = {
  skip: true,
  merge: true,
  path: ["args", "count"],
  map: (val, request) => {
    assertInt(request, "count", val);
    return ["COUNT", val];
  },
};

const zrangebyscoreOptionsProperty = {
  skip: true,
  merge: true,
  map: (val) => sanitizeArrayArgument(val),
  path: ["args", "options"],
};

const zrangebyscoreLimitProperty = {
  skip: true,
  merge: true,
  map: (val) => processLimit(val),
  path: ["args", "limit"],
};

function initMapping() {
  mapping = {
    append: {
      key: ["resource", "_id"],
      value: ["body", "value"],
    },
    bitcount: {
      key: ["resource", "_id"],
      start: { skip: true, path: ["args", "start"] },
      end: { skip: true, path: ["args", "end"] },
    },
    bitop: {
      operation: ["body", "operation"],
      destkey: ["resource", "_id"],
      keys: { merge: true, path: ["body", "keys"] },
    },
    bitpos: {
      key: ["resource", "_id"],
      bit: ["args", "bit"],
      start: { skip: true, path: ["args", "start"] },
      end: { skip: true, path: ["args", "end"] },
    },
    dbsize: null,
    decrby: {
      key: ["resource", "_id"],
      value: ["body", "value"],
    },
    del: {
      keys: ["body", "keys"],
    },
    expire: {
      key: ["resource", "_id"],
      seconds: ["body", "seconds"],
    },
    expireat: {
      key: ["resource", "_id"],
      timestamp: ["body", "timestamp"],
    },
    flushdb: null,
    geoadd: {
      key: { path: ["resource", "_id"] },
      points: {
        map: (val, request) => {
          const result = [];

          kassert.assertBodyHasAttribute(request, "points");
          kassert.assertBodyAttributeType(request, "points", "array");

          if (val.length === 0) {
            throw kerror.get("empty_argument", "points");
          }

          val.forEach((v) => {
            if (typeof v !== "object" || !v.lon || !v.lat || !v.name) {
              throw kerror.get(
                "invalid_argument",
                "points",
                "<array of geopoints>"
              );
            }

            assertFloat(request, "lon", v.lon);
            assertFloat(request, "lat", v.lat);

            result.push(v.lon, v.lat, v.name);
          });

          return result;
        },
        path: ["body", "points"],
        merge: true,
      },
    },
    geodist: {
      key: ["resource", "_id"],
      member1: ["args", "member1"],
      member2: ["args", "member2"],
      unit: { skip: true, path: ["args", "unit"] },
    },
    geohash: {
      key: ["resource", "_id"],
      members: {
        merge: true,
        map: (val) => toArray(val),
        path: ["args", "members"],
      },
    },
    georadius: {
      key: ["resource", "_id"],
      lon: ["args", "lon"],
      lat: ["args", "lat"],
      distance: ["args", "distance"],
      unit: ["args", "unit"],
      options: {
        skip: true,
        merge: true,
        map: (val) => sanitizeArrayArgument(val),
        path: ["args", "options"],
      },
    },
    georadiusbymember: {
      key: ["resource", "_id"],
      member: ["args", "member"],
      distance: ["args", "distance"],
      unit: ["args", "unit"],
      options: {
        skip: true,
        merge: true,
        map: (val) => sanitizeArrayArgument(val),
        path: ["args", "options"],
      },
    },
    getbit: {
      key: ["resource", "_id"],
      offset: ["args", "offset"],
    },
    getrange: {
      key: ["resource", "_id"],
      start: ["args", "start"],
      end: ["args", "end"],
    },
    hdel: {
      key: ["resource", "_id"],
      fields: { skip: true, merge: true, path: ["body", "fields"] },
    },
    hmget: {
      key: ["resource", "_id"],
      fields: {
        merge: true,
        map: (val) => toArray(val),
        path: ["args", "fields"],
      },
    },
    hexists: {
      key: ["resource", "_id"],
      field: ["args", "field"],
    },
    hincrby: {
      key: ["resource", "_id"],
      field: ["body", "field"],
      value: ["body", "value"],
    },
    hmset: {
      key: ["resource", "_id"],
      entries: {
        map: (val, request) => {
          const result = [];

          kassert.assertBodyHasAttribute(request, "entries");
          kassert.assertBodyAttributeType(request, "entries", "array");

          val.forEach((v) => {
            if (typeof v !== "object" || !v.field || !v.value) {
              throw kerror.get(
                "invalid_argument",
                "entries",
                "<array of object>"
              );
            }

            result.push(v.field, v.value);
          });

          return result;
        },
        path: ["body", "entries"],
        merge: true,
      },
    },
    hset: {
      key: ["resource", "_id"],
      field: ["body", "field"],
      value: ["body", "value"],
    },
    hstrlen: {
      key: ["resource", "_id"],
      field: ["args", "field"],
    },
    keys: {
      pattern: ["args", "pattern"],
    },
    lindex: {
      key: ["resource", "_id"],
      index: ["args", "idx"],
    },
    linsert: {
      key: ["resource", "_id"],
      position: ["body", "position"],
      pivot: ["body", "pivot"],
      value: ["body", "value"],
    },
    lpush: {
      key: ["resource", "_id"],
      values: { skip: true, merge: true, path: ["body", "values"] },
    },
    lrange: {
      key: ["resource", "_id"],
      start: ["args", "start"],
      stop: ["args", "stop"],
    },
    lrem: {
      key: ["resource", "_id"],
      count: ["body", "count"],
      value: ["body", "value"],
    },
    lset: {
      key: ["resource", "_id"],
      index: ["body", "index"],
      value: ["body", "value"],
    },
    ltrim: {
      key: ["resource", "_id"],
      start: ["body", "start"],
      stop: ["body", "stop"],
    },
    mget: {
      keys: {
        merge: true,
        map: (val) => toArray(val),
        path: ["args", "keys"],
      },
    },
    mexecute: {
      actions: ["body", "actions"],
    },
    mset: {
      entries: {
        map: (val, request) => {
          const result = [];

          kassert.assertBodyHasAttribute(request, "entries");
          kassert.assertBodyAttributeType(request, "entries", "array");
          val.forEach((entry) => {
            if (typeof entry !== "object" || !entry.key || !entry.value) {
              throw kerror.get(
                "invalid_argument",
                "entries",
                "<array of objects>"
              );
            }

            result.push(entry.key, entry.value);
          });

          return result;
        },
        path: ["body", "entries"],
        merge: true,
      },
    },
    object: {
      subcommand: ["args", "subcommand"],
      key: ["resource", "_id"],
    },
    pexpire: {
      key: ["resource", "_id"],
      milliseconds: ["body", "milliseconds"],
    },
    pexpireat: {
      key: ["resource", "_id"],
      timestamp: ["body", "timestamp"],
    },
    pfadd: {
      key: ["resource", "_id"],
      elements: { skip: true, merge: true, path: ["body", "elements"] },
    },
    pfmerge: {
      key: ["resource", "_id"],
      sources: { skip: true, merge: true, path: ["body", "sources"] },
    },
    ping: null,
    psetex: {
      key: ["resource", "_id"],
      milliseconds: ["body", "milliseconds"],
      value: ["body", "value"],
    },
    randomkey: null,
    rename: {
      key: ["resource", "_id"],
      newkey: ["body", "newkey"],
    },
    renamenx: {
      key: ["resource", "_id"],
      newkey: ["body", "newkey"],
    },
    rpoplpush: {
      source: ["body", "source"],
      destination: ["body", "destination"],
    },
    sadd: {
      key: ["resource", "_id"],
      members: { skip: true, merge: true, path: ["body", "members"] },
    },
    scan: {
      cursor: ["args", "cursor"],
      match: scanMatchProperty,
      count: scanCountProperty,
    },
    sdiff: {
      key: ["resource", "_id"],
      keys: {
        merge: true,
        map: (val) => toArray(val),
        path: ["args", "keys"],
      },
    },
    sdiffstore: {
      destination: ["body", "destination"],
      key: ["resource", "_id"],
      keys: { merge: true, path: ["body", "keys"] },
    },
    set: null, // handled by extractArgumentsFromRequestForSet
    setex: {
      key: ["resource", "_id"],
      seconds: ["body", "seconds"],
      value: ["body", "value"],
    },
    setnx: {
      key: ["resource", "_id"],
      value: ["body", "value"],
    },
    sinterstore: {
      destination: ["body", "destination"],
      keys: { merge: true, path: ["body", "keys"] },
    },
    sismember: {
      key: ["resource", "_id"],
      member: ["args", "member"],
    },
    smove: {
      key: ["resource", "_id"],
      destination: ["body", "destination"],
      member: ["body", "member"],
    },
    sort: null, // handled by extractArgumentsFromRequestForSort
    spop: {
      key: ["resource", "_id"],
      count: { skip: true, path: ["body", "count"] },
    },
    srandmember: {
      key: ["resource", "_id"],
      count: { skip: true, path: ["args", "count"] },
    },
    srem: {
      key: ["resource", "_id"],
      members: { skip: true, merge: true, path: ["body", "members"] },
    },
    sscan: {
      key: ["resource", "_id"],
      cursor: ["args", "cursor"],
      match: scanMatchProperty,
      count: scanCountProperty,
    },
    sunion: {
      keys: {
        merge: true,
        map: (val) => toArray(val),
        path: ["args", "keys"],
      },
    },
    sunionstore: {
      destination: ["body", "destination"],
      keys: { merge: true, path: ["body", "keys"] },
    },
    time: null,
    touch: {
      keys: { merge: true, path: ["body", "keys"] },
    },
    zadd: null, // handled by extractArgumentsFromRequestForZAdd
    zcount: {
      key: ["resource", "_id"],
      min: ["args", "min"],
      max: ["args", "max"],
    },
    zincrby: {
      key: ["resource", "_id"],
      value: ["body", "value"],
      member: ["body", "member"],
    },
    zinterstore: null, // handled by extractArgumentsFromRequestForZInterstore
    zlexcount: {
      key: ["resource", "_id"],
      min: ["args", "min"],
      max: ["args", "max"],
    },
    zrange: {
      key: ["resource", "_id"],
      start: ["args", "start"],
      stop: ["args", "stop"],
      options: {
        skip: true,
        merge: true,
        map: (val) => sanitizeArrayArgument(val),
        path: ["args", "options"],
      },
    },
    zrangebylex: {
      key: ["resource", "_id"],
      min: ["args", "min"],
      max: ["args", "max"],
      limit: {
        skip: true,
        merge: true,
        map: (val) => processLimit(val),
        path: ["args", "limit"],
      },
    },
    zrangebyscore: {
      key: ["resource", "_id"],
      min: ["args", "min"],
      max: ["args", "max"],
      options: zrangebyscoreOptionsProperty,
      limit: zrangebyscoreLimitProperty,
    },
    zrem: {
      key: ["resource", "_id"],
      members: { merge: true, path: ["body", "members"] },
    },
    zremrangebylex: {
      key: ["resource", "_id"],
      min: ["body", "min"],
      max: ["body", "max"],
    },
    zremrangebyrank: {
      key: ["resource", "_id"],
      min: ["body", "start"],
      max: ["body", "stop"],
    },
    zremrangebyscore: {
      key: ["resource", "_id"],
      min: ["body", "min"],
      max: ["body", "max"],
    },
    zrevrangebylex: {
      key: ["resource", "_id"],
      max: ["args", "max"],
      min: ["args", "min"],
      limit: {
        skip: true,
        merge: true,
        map: (val) => processLimit(val),
        path: ["args", "limit"],
      },
    },
    zrevrangebyscore: {
      key: ["resource", "_id"],
      max: ["args", "max"],
      min: ["args", "min"],
      options: zrangebyscoreOptionsProperty,
      limit: zrangebyscoreLimitProperty,
    },
    zrevrank: {
      key: ["resource", "_id"],
      member: ["args", "member"],
    },
    zunionstore: null, // handled by extractArgumentsFromRequestForZInterstore
  };

  // unique argument key
  mapping.decr =
    mapping.get =
    mapping.hgetall =
    mapping.hkeys =
    mapping.hlen =
    mapping.hvals =
    mapping.incr =
    mapping.llen =
    mapping.lpop =
    mapping.persist =
    mapping.pttl =
    mapping.rpop =
    mapping.scard =
    mapping.smembers =
    mapping.strlen =
    mapping.ttl =
    mapping.type =
    mapping.zcard =
      { key: ["resource", "_id"] };

  // key value
  mapping.getset =
    mapping.lpushx =
    mapping.rpushx =
      {
        key: ["resource", "_id"],
        value: ["body", "value"],
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
function extractArgumentsFromRequest(command, request) {
  let args = [];

  // Dealing with exceptions
  if (command === "set") {
    return extractArgumentsFromRequestForSet(request);
  }
  if (command === "sort") {
    return extractArgumentsFromRequestForSort(request);
  }
  if (command === "zadd") {
    return extractArgumentsFromRequestForZAdd(request);
  }
  if (command === "zinterstore") {
    return extractArgumentsFromRequestForZInterstore(request);
  }
  if (command === "zunionstore") {
    return extractArgumentsFromRequestForZInterstore(request);
  }
  if (command === "mexecute") {
    return extractArgumentsFromRequestForMExecute(request);
  }

  if (!mapping[command]) {
    return [];
  }

  if (!request.input.body) {
    request.input.body = {};
  }

  Object.keys(mapping[command]).forEach((key) => {
    const data = mapping[command][key];
    const path = Array.isArray(data) ? data : data.path;
    const toMerge = !Array.isArray(data) && data.merge === true;
    const map = !Array.isArray(data) && data.map;
    const skip = !Array.isArray(data) && data.skip === true;

    let value = path.reduce(
      (previousValue, currentValue, currentIndex, array) => {
        if (
          previousValue[array[currentIndex]] !== undefined &&
          previousValue[array[currentIndex]] !== null
        ) {
          return previousValue[array[currentIndex]];
        }
        return undefined;
      },
      request.input
    );

    if (value === undefined) {
      if (skip) {
        return;
      }
      throw kerror.get("missing_argument", key);
    }

    if (map) {
      value = data.map(value, request);
    }

    if (value !== undefined) {
      if (toMerge && Array.isArray(value)) {
        args = args.concat(value);
      } else {
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
function extractArgumentsFromRequestForSet(request) {
  const args = [request.input.args._id];

  kassert.assertHasId(request);
  kassert.assertHasBody(request);

  if (
    ["undefined", "boolean", "object"].indexOf(
      typeof request.input.body.value
    ) !== -1
  ) {
    throw kerror.get("invalid_type", "value", "string, number");
  }

  if (request.input.body.nx && request.input.body.xx) {
    throw kerror.get("mutually_exclusive", "nx", "xx");
  }

  if (request.input.body.ex && request.input.body.px) {
    throw kerror.get("mutually_exclusive", "ex", "px");
  }

  args.push(request.input.body.value);

  if (request.input.body.ex !== undefined) {
    args.push("EX", request.input.body.ex);
  }

  if (request.input.body.px !== undefined) {
    args.push("PX", request.input.body.px);
  }

  if (request.input.body.nx) {
    args.push("NX");
  }

  if (request.input.body.xx) {
    args.push("XX");
  }

  return args;
}

/**
 * @param {Request} request
 * @returns {*[]}
 */
function extractArgumentsFromRequestForSort(request) {
  const args = [request.input.args._id];

  kassert.assertHasId(request);

  if (request.input.body) {
    if (request.input.body.alpha) {
      args.push("ALPHA");
    }

    if (request.input.body.direction !== undefined) {
      const direction = request.input.body.direction.toUpperCase();

      if (["ASC", "DESC"].indexOf(direction) === -1) {
        throw kerror.get("invalid_argument", "direction", '"ASC", "DESC"');
      }

      args.push(direction);
    }

    if (request.input.body.by !== undefined) {
      args.push("BY", request.input.body.by);
    }

    if (request.input.body.limit !== undefined) {
      kassert.assertBodyAttributeType(request, "limit", "array");
      assertInt(request, "limit.offset", request.input.body.limit[0]);
      assertInt(request, "limit.count", request.input.body.limit[1]);

      args.push(
        "LIMIT",
        request.input.body.limit[0],
        request.input.body.limit[1]
      );
    }

    if (request.input.body.get !== undefined) {
      kassert.assertBodyAttributeType(request, "get", "array");

      request.input.body.get.forEach((pattern) => {
        args.push("GET");
        args.push(pattern);
      });
    }

    if (request.input.body.store !== undefined) {
      args.push("STORE", request.input.body.store);
    }
  }

  return args;
}

/**
 * @param {Request} request
 * @returns {*[]}
 */
function extractArgumentsFromRequestForMExecute(request) {
  kassert.assertHasBody(request);
  kassert.assertBodyHasAttribute(request, "actions");
  kassert.assertBodyAttributeType(request, "actions", "array");

  const actions = request.input.body.actions;

  return actions.map((command) => {
    if (!has(command, "action")) {
      throw kerror.get("missing_argument", "action");
    }
    if (!has(command, "args")) {
      throw kerror.get("missing_argument", "args");
    }
    if (!isPlainObject(command.args)) {
      throw kerror.get("invalid_type", "args", "object");
    }
    if (command.action === "mexecute") {
      throw kerror.get("forbidden_argument", "mexecute");
    }
    if (!has(mapping, command.action)) {
      throw kerror.get("forbidden_argument", command.action);
    }
    const subRequest = new Request(command.args);
    const extractedArguments = extractArgumentsFromRequest(
      command.action,
      subRequest
    );

    return [command.action, ...extractedArguments];
  });
}

/**
 * @param {Request} request
 * @returns {*[]}
 */
function extractArgumentsFromRequestForZAdd(request) {
  const args = [request.input.args._id];

  kassert.assertHasId(request);
  kassert.assertHasBody(request);
  kassert.assertBodyHasAttribute(request, "elements");
  kassert.assertBodyAttributeType(request, "elements", "array");

  if (request.input.body.nx && request.input.body.xx) {
    throw kerror.get("mutually_exclusive", "nx", "xx");
  }

  if (request.input.body.nx) {
    args.push("NX");
  }

  if (request.input.body.xx) {
    args.push("XX");
  }

  if (request.input.body.ch) {
    args.push("CH");
  }

  if (request.input.body.incr) {
    args.push("INCR");
  }

  if (request.input.body.elements.length === 0) {
    throw kerror.get("empty_argument", "elements");
  }

  if (request.input.body.incr && request.input.body.elements.length > 1) {
    throw kerror.get("too_many_arguments", "elements");
  }

  request.input.body.elements.forEach((element, index) => {
    if (!isPlainObject(element)) {
      throw kerror.get("invalid_argument", "elements", "<array of objects>");
    }

    if (!element.member) {
      throw kerror.get("missing_argument", `elements[${index}].member`);
    }

    assertFloat(request, "score", element.score);

    args.push(element.score);
    args.push(element.member);
  });

  return args;
}

/**
 * @param {Request} request
 * @returns {*[]}
 */
function extractArgumentsFromRequestForZInterstore(request) {
  let args = [request.input.args._id];

  kassert.assertHasId(request);
  kassert.assertHasBody(request);
  kassert.assertBodyHasAttribute(request, "keys");
  kassert.assertBodyAttributeType(request, "keys", "array");

  if (request.input.body.keys.length === 0) {
    throw kerror.get("empty_argument", "keys");
  }

  args.push(request.input.body.keys.length);
  args = args.concat(request.input.body.keys);

  if (request.input.body.weights) {
    kassert.assertBodyAttributeType(request, "weights", "array");

    if (request.input.body.weights.length > 0) {
      args.push("WEIGHTS");
      args = args.concat(request.input.body.weights);
    }
  }

  if (request.input.body.aggregate) {
    kassert.assertBodyAttributeType(request, "aggregate", "string");

    const aggregate = request.input.body.aggregate.toUpperCase();

    if (["SUM", "MIN", "MAX"].indexOf(aggregate) === -1) {
      throw kerror.get(
        "invalid_argument",
        "aggregate",
        '"SUM", "MIN" or "MAX"'
      );
    }

    args.push("AGGREGATE", aggregate);
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
    throw kerror.get("invalid_type", name, "number");
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
    throw kerror.get("invalid_type", name, "integer");
  }
}

/**
 * Deal with arguments being either an array or a string: return the array
 * intact if it's the former, and convert it to an array if it's a string
 * @param  {Array|String} arg
 * @returns {Array}
 */
function toArray(arg) {
  return typeof arg === "string" ? arg.split(",") : arg;
}

/**
 * Sanitize an array argument, converting it from a string if necessary
 * @param  {Array|String} arg
 * @returns {Array}
 */
function sanitizeArrayArgument(arg) {
  const result = toArray(arg);

  return result.map((v) => (typeof v === "string" ? v.toUpperCase() : v));
}

/**
 * Parse a LIMIT argument and throws if not a valid LIMIT parameter
 * @param  {Array} arg
 * @throws
 */
function processLimit(arg) {
  let result = ["LIMIT"];

  result = result.concat(toArray(arg));

  // "result" should contain LIMIT offset count
  if (result.length !== 3) {
    throw kerror.get("invalid_argument", "limit", "<offset, count>");
  }

  return result;
}

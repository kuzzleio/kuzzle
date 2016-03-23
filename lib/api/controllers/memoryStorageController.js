var
  _ = require('lodash'),
  commands = require('redis-commands'),
  blacklist,
  mapping,
  q = require('q'),
  BadRequestError = require('../core/errors/badRequestError'),
  ResponseObject = require('../core/models/responseObject');

module.exports = function MemoryStorageController(kuzzle) {

  initMapping();

  commands.list.forEach(command => {
    blacklist = [
      'client',
      'cluster',
      'config',
      'debug',
      'echo',
      'flushall',
      'migrate',
      'monitor',
      'move',
      'quit',
      'readonly',
      'readwrite',
      'role',
      'script',
      'select',
      'shutdown',
      'slaveof',
      'slowlog',
      'sync'
    ];

    if (blacklist.indexOf(command) > -1 || this[command]) {
      return true;
    }

    this[command] = (requestObject) => {
      kuzzle.pluginsManager.trigger('cache:' + command, requestObject)
        .then(newRequestObject => {
          return kuzzle.services.list.memoryStorage.apply(kuzzle.services.list.memoryStorage, extractArgumentsFromRequestObject(command, newRequestObject));
        })
        .then(response => {
          return q(new ResponseObject(requestObject, response));
        });
    };
  });

};

function initMapping () {
  mapping = {
    append: {
      key: ['_id'],
      value: ['body']
    },
    bgrewriteaof: null,
    bgsave: null,
    bitcount: {
      key: ['_id'],
      start: ['body', 'start'],
      end: ['body', 'end']
    },
    bitop: {
      operation: ['body', 'operation'],
      dest: ['body', 'dest'],
      src: { merge: true, path: ['body', 'src'] }
    },
    bitpos: {
      key: ['_id'],
      bit: ['body', 'bit'],
      start: ['body', 'start'],
      end: ['body', 'end']
    },
    blpop: {
      key: { skip: true, path: ['_id'] },
      keys: { merge: true, path: ['body', 'src'] },
      timeout: ['body', 'timeout']
    },
    brpoplpush: {
      source: ['body', 'source'],
      destination: ['body', 'destination']
    },
    dbsize: null,
    decrby: {
      key: ['_id'],
      decrement: ['body', 'decrement']
    },
    del: {
      key: { skip: true, path: ['_id'] },
      keys: { skip: true, path: ['body', 'keys'] }
    },
    discard: null,
    eval: {
      script: ['body', 'script'],
      numkeys: ['body', 'numkeys'],
      keys: { merge: true, path: ['body', 'keys'] }
    },
    evalsha1: {
      sha1: ['_id'],
      numkeys: ['body', 'numkeys'],
      keys: { merge: true, path: ['body', 'keys'] }
    },
    exec: null,
    exists: {
      key: { skip: true, path: ['_id'] },
      keys: { skipIfNotFoud: true, path: ['body', 'keys'] }
    },
    expire: {
      key: ['_id'],
      seconds: ['body', 'seconds']
    },
    expireat: {
      key: ['_id'],
      timestamp: ['body', 'timestamp']
    },
    flushdb: null,
    geoadd: {
      key: {skip: true, path: ['_id']},
      longitude: {skip: true, path: ['body', 'longitude']},
      latitude: {skip: true, path: ['body', 'latitude']},
      points: {skip: true, merge: true, path: ['body', 'points']},
      name: ['body', 'name']
    },
    geohash: {
      key: ['_id'],
      members: {merge: true, path: ['body', 'members']}
    },
    georadius: {
      key: ['_id'],
      longitude: ['body', 'longitude'],
      latitude: ['body', 'latitude'],
      distance: ['body', 'distance'],
      unit: ['body', 'unit'],
      withdist: {skip: true, path: ['body', 'withdist']},
      withcoord: {skip: true, path: ['body', 'withcoord']}
    },
    georadiusbymember: {
      key: ['_id'],
      member: ['body', 'member'],
      distance: ['body', 'distance'],
      unit: ['body', 'unit'],
      withdist: {skip: true, path: ['body', 'withdist']},
      withcoord: {skip: true, path: ['body', 'withcoord']}
    },
    getbit: {
      key: ['_id'],
      offset: ['body', 'offset']
    },
    getrange: {
      key: ['_id'],
      start: ['body', 'start'],
      end: ['body', 'end']
    },
    hdel: {
      key: ['_id'],
      field: {skip: true, path: ['body', 'field']},
      fields: {skip: true, merge: true, path: ['body', 'fields']}
    },
    hexists: {
      key: ['_id'],
      field: ['body', 'field']
    },
    hincrby: {
      key: ['_id'],
      field: ['body', 'field'],
      increment: ['body', 'increment']
    },
    hmset: {
      key: ['_id'],
      field: {skip: true, path: ['body', 'field']},
      value: {skip: true, path:['body', 'value']},
      values: {skip: true, merge: true, path: ['body', 'values']}
    },
    hset: {
      key: ['_id'],
      field: ['body', 'field'],
      value: ['body']
    },
    info: {
      section: {skip: true, path: ['body', 'section']}
    },
    keys: {
      pattern: ['body', 'pattern']
    },
    lastsave: null,
    lindex: {
      key: ['_id'],
      index: ['body', 'index']
    },
    linsert: {
      key: ['_id'],
      beforeAfter: ['body', 'beforeAfter'],
      pivot: ['body', 'pivot'],
      value: ['body', 'value']
    },
    lpush: {
      key: ['_id'],
      value: {skip: true, path: ['body', 'value']},
      values: {skip: true, merge: true, path: ['body', 'values']}
    },
    lrange: {
      key: ['_id'],
      start: ['body', 'start'],
      stop: ['body', 'stop']
    },
    lrem: {
      key: ['_id'],
      count: ['body', 'count'],
      value: ['body', 'value']
    },
    lset: {
      key: ['_id'],
      index: ['body', 'index'],
      value: ['body', 'value']
    },
    ltrim: {
      key: ['_id'],
      start: ['body', 'start'],
      stop: ['body', 'stop']
    },
    mget: {
      key: {skip: true, path: ['_id']},
      keys: {skip: true, merge: true, path: ['body', 'keys']}
    },
    mset: {
      key: {skip: true, path: ['_id']},
      value: {skip: true, path: ['body', 'value']},
      values: {skip: true, merge: true, path: ['body', 'values']}
    },
    multi: null,
    object: {
      subcommand: ['body', 'subcommand'],
      args: {merge: true, path: ['body', 'args']}
    },
    pexpire: {
      key: ['_id'],
      milliseconds: ['body', 'milliseconds']
    },
    pexpireat: {
      key: ['_id'],
      timestamp: ['body', 'timestamp']
    },
    pfadd: {
      key: ['_id'],
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
      key: ['_id'],
      milliseconds: ['body', 'milliseconds'],
      value: ['body', 'value']
    },
    psubcrbibe: {
      pattern: {skip: true, path: ['body', 'pattern']},
      patterns: {skip: true, merge: true, path: ['body', 'patterns']}
    },
    pubsub: {
      subcommand: ['body', 'subcommand'],
      args: {skip: true, path: ['body', 'args']}
    },
    publish: {
      channel: ['body', 'channel'],
      message: ['body', 'message']
    },
    punsubscribe: {
      pattern: {skip: true, path: ['body', 'pattern']},
      patterns: {skip: true, merge: true, path: ['body', 'patterns']}
    },
    randomkey: null,
    rename: {
      key: ['_id'],
      newkey: ['body', 'newkey']
    },
    renamenx: {
      key: ['_id'],
      newkey: ['body', 'newkey']
    },
    restore: {
      key: ['_id'],
      ttl: ['body', 'ttl'],
      content: ['body', 'content']
    },
    rpoplpush: {
      source: ['body', 'source'],
      destination: ['body', 'destination']
    },
    sadd: {
      key: ['_id'],
      member: {skip: true, path: ['body', 'member']},
      members: {skip: true, merge: true, path: ['body', 'members']}
    },
    save: null,
    sdiffstore: {
      destination: ['body', 'destination'],
      key: {skip: true, path: ['_id']},
      keys: {skip: true, merge: true, path: ['body', 'keys']}
    },
    set: {
      key: ['_id'],
      value: ['body', 'value'],
      ex: {skip: true, path: ['body', 'ex']}

    },
    setbit: {
      key: ['_id'],
      offset: ['body', 'offset'],
      value: ['body', 'value']
    },
    setex: {
      key: ['_id'],
      seconds: ['body', 'seconds'],
      value: ['body', 'value']
    },
    setrange: {
      key: ['_id'],
      offset: ['body', 'offset'],
      value: ['body', 'value']
    },
    sinterstore: {
      destination: ['body', 'destination'],
      key: {skip: true, path: ['_id']},
      keys: {skip: true, merge: true, path: ['body', 'keys']}
    },
    sismember: {
      key: ['_id'],
      member: ['body', 'member']
    },
    smove: {
      source: ['body', 'source'],
      destination: ['body', 'destination'],
      member: ['body', 'member']
    },
    spop: {
      key: ['_id'],
      count: ['body', 'count']
    },
    srem: {
      key: ['_id'],
      member: {skip: true, path: ['body', 'member']},
      members: {skip: true, merge: true, path: ['body', 'members']}
    },
    subscribe: {
      channel: {skip: true, path: ['body', 'channel']},
      channels: {skip: true, merge: true, path: ['body', 'channels']}
    },
    sunionstore: {
      destination: ['body', 'destination'],
      key: {skip: true, path: ['_id']},
      keys: {skip: true, merge: true, path: ['body', 'keys']}
    },
    unwatch: null,
    wait: {
      numslaves: ['body', 'numslaves'],
      timeout: ['body', 'timeout']
    },
    zcount: {
      key: ['_id'],
      min: ['body', 'min'],
      max: ['body', 'max']
    },
    zincrby: {
      key: ['_id'],
      increment: ['body', 'increment'],
      member: ['body', 'member']
    },
    zinterstore: {

    },
    zlexcount: {
      key: ['_id'],
      min: ['body', 'min'],
      max: ['body', 'max']
    },
    zrange: {
      key: ['_id'],
      start: ['body', 'start'],
      stop: ['body', 'stop'],
      withscore: {skip: true, map: () => { return 'WITHSCORES' }, path: ['body', 'withscores']}
    },
    zrevrank: {
      key: ['_id'],
      member: ['body', 'member']
    },
    zunionstore: {
      destination: ['body', 'destination']

    },
    scan: {
      cursor: ['body', 'cursor'],
      match: {
        skip: true,
        merge: true,
        map: pattern => { return ['MATCH', pattern]; },
        path: ['body', 'pattern']
      },
      count: {
        skip: true,
        merge: true,
        map: count => { return ['COUNT', count]; },
        path: ['body', 'count']
      }
    },
    sscan: {
      key: ['_id'],
      cursor: ['body', 'cursor'],
      match: {
        skip: true,
        merge: true,
        map: pattern => { return ['MATCH', pattern]; },
        path: ['body', 'pattern']
      },
      count: {
        skip: true,
        merge: true,
        map: count => { return ['COUNT', count]; },
        path: ['body', 'count']
      }
    }
  };

  // unique argument key
  mapping.decr = mapping.get = mapping.dump = mapping.hgetall = mapping.hkeys = mapping.hlen = mapping.incr = mapping.llen = mapping.lpop = mapping.persist = mapping.pttl = mapping.rpop = mapping.scard = mapping.smembers = mapping.strlen = mapping.ttl = mapping.type = mapping.zcard = { key: ['_id'] };

  // key value
  mapping.getset = mapping.lpushx = {
    key: ['_id'],
    value: ['body']
  };

  // key key...
  mapping.del = mapping.exists = mapping.mget = mapping.pfcount = mapping.sdiff = mapping.sinter = mapping.sunion = mapping.watch = {
    key: {skip: true, path: ['_id'] },
    keys: {skip: true, merge: true, path: ['body', 'keys']}
  };

  mapping.incrby = mapping.incrbyfloat = mapping.decrby;
  mapping.brpop = mapping.blpop;
  mapping.geopos = mapping.geodist = mapping.geohash;
  mapping.hget = mapping.hstrlen = mapping.hexists;
  mapping.hmget = mapping.hdel;
  mapping.hsetnx = mapping.hset;
  mapping.msetnx = mapping.mset;
  mapping.rpush = mapping.lpush;
  mapping.hincrbyfloat = mapping.hincrby;
  mapping.srandmember = mapping.spop;
  mapping.unsubscribe = mapping.channel;
  mapping.zrevrange = mapping.zrange;
  mapping.zscore = mapping.zrevrank;
  mapping.hscan = mapping.zscan = mapping.sscan;
}

function extractArgumentsFromRequestObject (command, requestObject) {
  var
    args = [];

  // Dealing with exceptions
  if (command === 'set') {
    return extractArgumentsFromRequestObjectForSet(requestObject);
  }
  if (command === 'sort') {
    return extractArgumentsFromRequestObjecForSort(requestObject);
  }
  if (command === 'zadd') {
    return extractArgumentsFromRequestObjectForZAdd(requestObject);
  }
  if (command === 'zinsterstore') {
    return extractArgumentsFromRequestObjectForZInterstore(requestObject);
  }
  if (command === 'zrangebylex') {
    return extractArgumentsFromRequestObjectForZRangeByLex(requestObject);
  }
  if (command === 'zrevrangebylex') {
    return extractArgumentsFromRequestObjectForZRangeByLex(requestObject);
  }
  if (command === 'zrangebyscore') {
    return extractArgumentsFromRequestObjectForZRangeByScore(requestObject);
  }
  if (command === 'zrevrangebyscore') {
    return extractArgumentsFromRequestObjectForZRangeByScore(requestObject);
  }
  if (command === 'zunionstore') {
    return extractArgumentsFromRequestObjectForZInterstore(requestObject);
  }

  if (!mapping[command]) {
    return [];
  }


  Object.keys(mapping[command]).forEach(key => {
    var
      data = mapping[command][key],
      path = _.isArray(data) ? data : data.path,
      toMerge = !_.isArray(data) && data.merge,
      map = !_.isArray(data) && data.map,
      skip = !_.isArray(data) && data.skip,
      value;

    value = path.reduce((previousValue, currentValue, currentIndex, array) => {
      if (previousValue[array[currentIndex]]) {
        return previousValue[array[currentIndex]];
      }
      return undefined;
    }, requestObject.data);

    if (skip && value === undefined) {
      return;
    }

    if (toMerge && _.isArray(value)) {
      args = args.concat(map ? data.map(value) : value);
    } else {
      args.push(map ? data.map(value) : value);
    }
  });

  return args;
}

function extractArgumentsFromRequestObjectForSet (requestObject) {
  var
    args = [requestObject.data._id],
    ex,
    px,
    nx,
    xx;


  if (requestObject.data.body.ex !== undefined) {
    ex = requestObject.data.body.ex;
  }

  if (requestObject.data.body.px !== undefined) {
    px = requestObject.data.body.px;
    ex = undefined;
  }

  if (requestObject.data.body.nx !== undefined) {
    nx = requestObject.data.body.nx;
  }

  if (requestObject.data.body.xx !== undefined) {
    xx = requestObject.data.body.px;
  }


  if (requestObject.data.body.value === undefined && ex === undefined && px === undefined && nx === undefined && xx === undefined) {
    // it looks like the request body is the value to set.
    args.push(requestObject.data.body);
  }
  else {
    args.push(requestObject.data.body.value);
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

function extractArgumentsFromRequestObjecForSort (requestObject) {
  var
    args = [requestObject.data._id];

  if (requestObject.data.body.alpha !== undefined && requestObject.data.body.alpha) {
    args.push('ALPHA');
  }

  if (requestObject.data.body.direction !== undefined) {
    args.push(requestObject.data.body.direction.toUpperCase());
  }

  if (requestObject.data.body.by !== undefined) {
    args = args.concat(['BY', requestObject.data.body.by]);
  }

  if (requestObject.data.body.count !== undefined) {
    args = args.concat([
      'LIMIT',
      requestObject.data.body.offset !== undefined ? requestObject.data.body.offset : 0,
      requestObject.data.body.count
    ]);
  }

  if (requestObject.data.body.get !== undefined) {
    args = args.concat(['GET', requestObject.data.body.get]);
  }

  if (requestObject.data.body.store !== undefined) {
    args = args.concat(['STORE', requestObject.data.body.store]);
  }

  return args;
}

function extractArgumentsFromRequestObjectForZAdd (requestObject) {
  var args = [requestObject.data._id];

  if (requestObject.data.body.nx === true) {
    args.push('NX');
  }
  else if (requestObject.data.body.xx === true) {
    args.push('XX');
  }

  if (requestObject.data.body.ch === true) {
    args.push('CH')
  }

  if (requestObject.data.body.incr === true) {
    args.push('INCR');
  }

  if (requestObject.data.body.score !== undefined) {
    args.push(requestObject.data.body.score);
    args.push(requestObject.data.body.member);
  }

  if (_.isArray(requestObject.data.body.values)) {
    args = args.concat(requestObject.data.body.values.map(element => {
      return [element.score, element.member];
    }))
  }

  return args;
}

function extractArgumentsFromRequestObjectForZInterstore (requestObject) {
  var args = [
    requestObject.data.body.destination,
    requestObject.data.body.numkeys
  ];

  if (requestObject.data._id !== undefined) {
    args.push(requestObject.data._id);
  }
  if(requestObject.data.body.keys != undefined) {
    if (!_.isArray(requestObject.data.body.keys)) {
      throw(new BadRequestError('Unexpected keys parameter type. Array expected'));
    }

    args = args.concat(requestObject.data.body.keys);
  }

  if (requestObject.data.body.weights != undefined) {
    if (!_.isArray(requestObject.data.body.weights)) {
      throw(new BadRequestError('Unexpected weights paramter type. Array expected'));
    }

    args.push('WEIGHTS');
    args = args.concat(requestObject.data.body.weights);
  }

  if (requestObject.data.body.aggregate !== undefined) {
    args = args.concat(['AGGREGATE', requestObject.data.body.aggregate.toUpperCase()]);
  }

  return args;
}

function extractArgumentsFromRequestObjectForZRangeByLex (requestObject) {
  var args = [
    requestObject.data._id,
    requestObject.data.body.min,
    requestObject.data.body.max
  ];

  if (requestObject.data.body.count !== undefined) {
    args = args.concat([
      'LIMIT',
      requestObject.data.body.offset !== undefined ? requestObject.data.body.offset : 0,
      requestObject.data.body.count
    ]);
  }

  return args;
}

function extractArgumentsFromRequestObjectForZRangeByScore (requestObject) {
  var args = [
    requestObject.data._id,
    requestObject.data.body.min,
    requestObject.data.body.max
  ];

  if (requestObject.data.body.withscores === true) {
    args.push('WITHSCORES');
  }

  if (requestObject.data.body.count !== undefined) {
    args = args.concat([
      'LIMIT',
      requestObject.data.body.offset !== undefined ? requestObject.data.body.offset : 0,
      requestObject.data.body.count
    ])
  }

  return args;
}

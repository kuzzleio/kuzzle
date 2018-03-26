const
  should = require('should'),
  rewire = require('rewire'),
  Redis = rewire('../../lib/services/redis'),
  IORedis = require('ioredis'),
  redisCommands = (require('ioredis')({lazyConnect: true})).getBuiltinCommands(),
  KuzzleMock = require('../mocks/kuzzle.mock'),
  sinon = require('sinon'),
  RedisClientMock = require('../mocks/services/redisClient.mock');

describe('Test redis service', () => {
  let
    kuzzle,
    redis;
  const
    dbname = 'unit-tests',
    sandbox = sinon.sandbox.create();

  before(() => {
    kuzzle = new KuzzleMock();
    redis = new Redis(kuzzle, {service: dbname}, {});
    return Redis.__with__('buildClient', () => new RedisClientMock())(() => {
      return redis.init();
    });
  });

  beforeEach(() => {
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should init a redis client with default (0) database', () => {
    const
      myRedis = new Redis(kuzzle, {service: dbname}, {}),
      myRedisClient = new RedisClientMock(),
      spy = sandbox.spy(myRedisClient, 'select');

    return Redis.__with__('buildClient', () => myRedisClient)(() => {
      return myRedis.init()
        .then(() => {
          try {
            should(myRedis).have.property('_client');
            should(myRedis._client).be.an.Object();
            should(spy).not.be.called();

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });

  it('should select the good database at init if > 0', () => {
    const
      myRedis = new Redis(kuzzle, {service: dbname}, {database: 1}),
      myRedisClient = new RedisClientMock(),
      spy = sandbox.spy(myRedisClient, 'select');

    return Redis.__with__('buildClient', () => myRedisClient)(() => {
      return myRedis.init()
        .then(() => {
          try {
            should(myRedis).have.property('_client');
            should(myRedis._client).be.an.Object();
            should(spy).be.calledWith(1);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });

  it('should not flush publicCache', () => {
    const
      myRedis = new Redis(kuzzle, {service: dbname}, {}),
      myRedisClient = new RedisClientMock(),
      spy = sandbox.spy(myRedisClient, 'flushdb');

    return Redis.__with__('buildClient', () => myRedisClient)(() => {
      return myRedis.init()
        .then(() => {
          try {
            should(myRedis).have.property('_client');
            should(myRedis._client).be.an.Object();
            should(spy).not.be.called();

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });

  it('should raise an error if unable to connect', () => {
    const testredis = new Redis(kuzzle, {service: dbname}, {});

    return Redis.__with__('buildClient', () => new RedisClientMock(new Error('connection error')))(() => {
      return should(testredis.init()).be.rejected();
    });
  });

  it('should raise an error if unable to select the database', () => {
    const testredis = new Redis(kuzzle, {service: dbname}, {database: 17});

    return Redis.__with__('buildClient', () => new RedisClientMock())(() => {
      return should(testredis.init()).be.rejected();
    });

  });

  it('should allow getting a single key value', () => {
    return redis.get('foo')
      .then(req => {
        try {
          should(req.name).be.exactly('get');
          should(req.args).be.eql(['foo']);

          return Promise.resolve();
        }
        catch(error) {
          return Promise.reject(error);
        }
      });
  });

  it('should retrieve values from multiple keys', () => {
    return redis.mget(['foo', 'baz'])
      .then(req => {
        try {
          should(req.name).be.exactly('mget');
          should(req.args).be.eql([['foo', 'baz']]);

          return Promise.resolve();
        }
        catch(error) {
          return Promise.reject(error);
        }
      });
  });

  it('should do nothing when attempting to retrieve values from an empty list of keys', () => {
    return should(redis.mget([])).be.fulfilledWith([]);
  });

  it('should allow listing keys using pattern matching', () => {
    return redis.searchKeys('s*')
      .then(keys => {
        try {
          should(keys).be.eql(['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9']);

          return Promise.resolve();
        }
        catch(error) {
          return Promise.reject(error);
        }
      });
  });

  it('should retrieve all stored keys of a database', () => {
    return redis.getAllKeys()
      .then(keys => {
        try {
          should(keys).be.eql(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

          return Promise.resolve();
        }
        catch(error) {
          return Promise.reject(error);
        }
      });
  });

  it('#set should set a single value', () => {
    return redis.set('foo', 'bar')
      .then(req => {
        try {
          should(req.name).be.exactly('set');
          should(req.args).be.eql(['foo', 'bar']);

          return Promise.resolve();
        }
        catch(error) {
          return Promise.reject(error);
        }
      });
  });

  it('#expireAt should allow to set a ttl based on a timestamp', () => {
    return redis.expireAt('foo', 999)
      .then(req => {
        try {
          should(req.name).be.exactly('expireat');
          should(req.args).be.eql(['foo', 999]);

          return Promise.resolve();
        }
        catch(error) {
          return Promise.reject(error);
        }
      });
  });

  it('#getInfos should return a properly formatted response', () => {
    sandbox.stub(redis._client, 'info').returns(Promise.resolve(`redis_version:3.0.7
    redis_git_sha1:00000000
    redis_git_dirty:0
    redis_build_id:fcba39adccee99b1
    redis_mode:standalone
    os:Linux 4.4.0-21-generic x86_64
    arch_bits:64
    multiplexing_api:epoll
    gcc_version:5.3.0
    process_id:1
    run_id:f895b62f0a240e86e347e6c1b787980a624f9e61
    tcp_port:6379
    uptime_in_seconds:165526
    uptime_in_days:1
    hz:10
    lru_clock:2913828
    config_file:

      # Clients
    connected_clients:7
    client_longest_output_list:0
    client_biggest_input_buf:0
    blocked_clients:0

# Memory
    used_memory:941592
    used_memory_human:919.52K
    used_memory_rss:7184384
    used_memory_peak:20273096
    used_memory_peak_human:19.33M
    used_memory_lua:36864
    mem_fragmentation_ratio:7.63
    mem_allocator:jemalloc-3.6.0

# Persistence
    loading:0
    rdb_changes_since_last_save:42
    rdb_bgsave_in_progress:0
    rdb_last_save_time:1462531408
    rdb_last_bgsave_status:ok
    rdb_last_bgsave_time_sec:0
    rdb_current_bgsave_time_sec:-1
    aof_enabled:0
    aof_rewrite_in_progress:0
    aof_rewrite_scheduled:0
    aof_last_rewrite_time_sec:-1
    aof_current_rewrite_time_sec:-1
    aof_last_bgrewrite_status:ok
    aof_last_write_status:ok

# Stats
    total_connections_received:24290
    total_commands_processed:86211
    instantaneous_ops_per_sec:0
    total_net_input_bytes:3631343
    total_net_output_bytes:47955049
    instantaneous_input_kbps:0.00
    instantaneous_output_kbps:0.00
    rejected_connections:0
    sync_full:0
    sync_partial_ok:0
    sync_partial_err:0
    expired_keys:14024
    evicted_keys:0
    keyspace_hits:509
    keyspace_misses:156
    pubsub_channels:0
    pubsub_patterns:0
    latest_fork_usec:985
    migrate_cached_sockets:0

# Replication
    role:master
    connected_slaves:0
    master_repl_offset:0
    repl_backlog_active:0
    repl_backlog_size:1048576
    repl_backlog_first_byte_offset:0
    repl_backlog_histlen:0

# CPU
    used_cpu_sys:176.93
    used_cpu_user:75.82
    used_cpu_sys_children:176.92
    used_cpu_user_children:75.82

# Cluster
    cluster_enabled:0

# Keyspace
    db1:keys=5,expires=5,avg_ttl=3584283
    db5:keys=1,expires=0,avg_ttl=0
    `));
    return should(redis.getInfos()).be.fulfilled();
  });

  it('should implement all canonical methods', () => {
    redisCommands.forEach(command => should(redis[command]).be.a.Function());
  });

  it('should build a client instance of Cluster if several nodes are defined', () => {
    const config = {
      nodes: [
        {host: 'foobar', port: 6379, lazyConnect: true}
      ]
    };

    sandbox.stub(IORedis, 'Cluster').returns({});

    Redis.__get__('buildClient')(config);
    should(IORedis.Cluster.called).be.true();
  });

  it('should build a client instance of Redis if only one node is defined', () => {
    const config = {
      node: {host: 'foobar', port: 6379, lazyConnect: true},
    };

    sandbox.stub(IORedis, 'Cluster').returns({});

    Redis.__get__('buildClient')(config);
    should(IORedis.Cluster.called).be.false();
  });
});

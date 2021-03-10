'use strict';

const should = require('should');
const rewire = require('rewire');
const sinon = require('sinon');

const KuzzleMock = require('../../mocks/kuzzle.mock');
const RedisClientMock = require('../../mocks/service/redisClient.mock');
const RedisClusterClientMock = require('../../mocks/service/redisClusterClient.mock');

const Redis = rewire('../../../lib/service/cache/redis');

describe('Redis', () => {
  let redis;
  let config;

  beforeEach(() => {
    new KuzzleMock();

    sinon
      .stub(Redis.prototype, '_buildClient')
      .callsFake((options) => new RedisClientMock(options));
    sinon
      .stub(Redis.prototype, '_buildClusterClient')
      .callsFake((options) => new RedisClusterClientMock(options));

    config = {
      node: {
        host: 'redis',
        port: 6379
      }
    };

    redis = new Redis(config);
  });

  afterEach(() => {
    Redis.prototype._buildClient.restore();
    Redis.prototype._buildClusterClient.restore();
  });

  it('should init a redis client with default (0) database', async () => {
    await redis.init();

    should(redis.client).be.an.Object();
    should(redis.client.select).not.be.called();
  });

  it('should raise an error if unable to connect', () => {
    Redis.prototype._buildClient
      .returns((new RedisClientMock()).emitError(new Error('connection error')));

    const testredis = new Redis(config);

    return should(testredis.init()).be.rejected();
  });

  it('should allow listing keys using pattern matching', async () => {
    await redis.init();

    const keys = await redis.searchKeys('s*');

    should(keys)
      .be.eql(['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9']);
  });

  it('should allow executing multiple commands', async () => {
    await redis.init();

    const commands = [
      [ 'set', 'a', 1 ],
      [ 'get', 'a' ],
      [ 'del', 'a' ],
    ];
    const wanted = [
      [ null, 'OK' ],
      [ null, '1' ],
      [ null, 1 ],
    ];

    redis.client.multi.returns({ exec: () => wanted });

    const result = await redis.mExecute(commands);

    should(redis.client.multi).be.calledWithMatch(commands);
    should(result).match(wanted);
  });

  it('should do nothing when attempting to execute a list of empty commands', () => {
    return should(redis.mExecute([])).be.fulfilledWith([]);
  });

  it('#info should return a properly formatted response', async () => {
    await redis.init();

    // eslint-disable-next-line require-atomic-updates
    redis.client.info.resolves(`redis_version:3.0.7
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
connectedclients:7
client_longest_output_list:0
client_biggest_input_buf:0
blockedclients:0

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
`);

    return should(redis.info()).be.fulfilledWith({
      memoryPeak: '19.33M',
      memoryUsed: '919.52K',
      mode: 'standalone',
      type: 'redis',
      version: '3.0.7',
    });
  });

  it('should build a client instance of Cluster if several nodes are defined', async () => {
    config = {
      nodes: [
        { host: 'foobar', port: 6379 }
      ]
    };
    redis = new Redis(config);

    await redis.init();

    should(redis._buildClusterClient).be.called();
  });

  it('should pass redis and cluster options to a client instance of Cluster', async () => {
    config = {
      nodes: [
        { host: 'foobar', port: 6379 }
      ],
      clusterOptions: {
        overrideDnsValidation: true
      },
      options: {
        username: 'foo',
        password: 'bar'
      }
    };
    redis = new Redis(config);

    await redis.init();

    should(redis._buildClusterClient).be.called();
    should(redis.client.options).match({ overrideDnsValidation: true, redisOptions: { username: 'foo', password: 'bar' } });
    should(redis.client.options.dnsLookup).be.Function();
  });

  it('should build a client instance of Redis if only one node is defined', async () => {
    config = {
      node: { host: 'foobar', port: 6379 },
    };

    redis = new Redis(config);

    await redis.init();

    should(redis._buildClient).be.called();
  });

  it('should pass redis options to a client instance of Redis', async () => {
    config = {
      node: { host: 'foobar', port: 6379 },
      options: {
        username: 'foo',
        password: 'bar'
      }
    };
    redis = new Redis(config);

    await redis.init();

    should(redis._buildClient).be.called();
    should(redis.client.options).match({ username: 'foo', password: 'bar' });
  });

  describe('#store', () => {
    beforeEach(() => {
      return redis.init();
    });

    it('should create a key/value pair with default options', async () => {
      await redis.store('foo', 'bar');

      should(redis.client.set).calledWith('foo', 'bar');
    });

    it('should send an NX option if the "onlyIfNew" option is set', async () => {
      await redis.store('foo', 'bar', { onlyIfNew: true });

      should(redis.client.set).calledWith('foo', 'bar', 'NX');
    });

    it('should send a PX option if the "ttl" option is set', async () => {
      await redis.store('foo', 'bar', { ttl: 123 });

      should(redis.client.set).calledWith('foo', 'bar', 'PX', 123);
    });

    it('should mix NX and PX options if needed', async () => {
      await redis.store('foo', 'bar', { onlyIfNew: true, ttl: 456 });

      should(redis.client.set).calledWith('foo', 'bar', 'NX', 'PX', 456);
    });
  });
});

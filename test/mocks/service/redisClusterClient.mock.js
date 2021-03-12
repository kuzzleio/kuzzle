'use strict';

const sinon = require('sinon');
const IORedis = require('ioredis');
const RedisClientMock = require('./redisClient.mock');

const getBuiltinCommands = (new IORedis.Cluster({redisOptions: { lazyConnect: true } })).getBuiltinCommands;

/**
 * @param err
 * @constructor
 */
class RedisClusterClientMock extends RedisClientMock {
  constructor (options, err) {
    super(options, err);

    this.getBuiltinCommands = getBuiltinCommands;

    getBuiltinCommands().forEach(command => {
      this[command] = sinon.stub().resolves();
    });
  }
}

module.exports = RedisClusterClientMock;

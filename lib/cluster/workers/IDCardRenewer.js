'use strict';

const { isMainThread, parentPort } = require('worker_threads');
const Redis = require('../../service/cache/redis');

class IDCardRenewer {

  constructor () {
    this.parentPort = parentPort;
    this.redis = null;
    this.refreshTimer = null;
    this.nodeIdKey = null;
    this.refreshDelay = 2000;
    this.disposed = true; // Disposed until initialized
  }

  async init (config) {
    if (! this.disposed) {
      return; // Already initialized
    }

    this.disposed = false;
    this.nodeIdKey = config.nodeIdKey;
    this.refreshDelay = config.refreshDelay || 2000;
    this.refreshMultiplier = config.refreshMultiplier;

    /**
    * Since we do not have access to the Kuzzle Context we can't use kuzzle.ask('core:cache:internal:*',...),
    * so we need to have an instance of Redis similar to the one used in the Cache Engine
    */
    try {
      const redisConf = config.redis || {};
      await this.initRedis(redisConf.config, redisConf.name);
    }
    catch (error) {
      this.parentPort.postMessage({
        error: `Failed to connect to redis, could not refresh ID card: ${error.message}`
      });
      return;
    }

    /**
     * Early renew, otherwise we need to wait the refreshDelay before the first ID Card renewal
     * which could be enough to make the ID Card expire.
     */
    await this.renewIDCard();
    if (!this.disposed) {
      this.refreshTimer = setInterval(
        this.renewIDCard.bind(this),
        this.refreshDelay);
    }

    // Notify that the worker is running and updating the ID Card
    this.parentPort.postMessage({ initialized: true });
  }

  async initRedis (config, name) {
    const redis = new Redis(config, name);
    await redis.init();
    this.redis = redis;
  }

  async renewIDCard () {
    if (this.disposed) {
      return; // Do not refresh ID Card when worker has been disposed
    }

    try {
      const refreshed = await this.redis.commands.pexpire(
        this.nodeIdKey,
        this.refreshDelay * this.refreshMultiplier);
      // Unable to refresh the key in time before it expires
      // => this node is too slow, we need to remove it from the cluster
      if (refreshed === 0) {
        await this.dispose();
        this.parentPort.postMessage({ error: 'Node too slow: ID card expired' });
      }
    }
    catch (error) {
      await this.dispose();
      this.parentPort.postMessage({
        error: `Failed to refresh ID Card: ${error.message}`
      });
    }
  }

  async dispose () {
    if (this.disposed) {
      return; // Already disposed
    }

    this.disposed = true;

    clearInterval(this.refreshTimer);
    this.refreshTimer = null;

    // If the worker is disposed before it had time to starts, redis service
    // may not have been initialized
    if (! this.redis) {
      return;
    }

    try {
      await this.redis.commands.del(this.nodeIdKey);
    }
    catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Could not delete key '${this.nodeIdKey}' from redis: ${error.message}`);
    }
  }
}

if (!isMainThread) {
  const idCardRenewer = new IDCardRenewer();

  parentPort.on('message', async message => {
    if (message.action === 'start') {
      // Simulate basic global Kuzzle Context
      global.kuzzle = { ...message.kuzzle };
      global.kuzzle.log = {
        debug: console.debug, // eslint-disable-line no-console
        error: console.error, // eslint-disable-line no-console
        info: console.info, // eslint-disable-line no-console
        warn: console.warn, // eslint-disable-line no-console
      };
      // Should never throw
      await idCardRenewer.init(message);
    }
    else if (message.action === 'dispose') {
      // Should never throw
      await idCardRenewer.dispose();
    }
  });
}

module.exports = { IDCardRenewer };

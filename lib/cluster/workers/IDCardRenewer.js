'use strict';
const { isMainThread, parentPort } = require('worker_threads');
const Redis = require('../../service/cache/redis');

class IDCardRenewer {
  constructor() {
    this.disposed = false;
    this.redis = null;
    this.refreshTimer = null;
    this.nodeIdKey = null;
    this.refreshDelay = 2000;

    this.parentPort = parentPort;
  }

  async init(config) {
    this.disposed = false;
    this.nodeIdKey = config.nodeIdKey;
    this.refreshDelay = config.refreshDelay;
    
    /**
    * Since we do not have access to the Kuzzle Context we can't use kuzzle.ask('core:cache:internal:*',...),
    * so we need to have an instance of Redis similar to the one used in the Cache Engine
    */
    this.redis = new Redis(config.redis.config, config.redis.name);
    await this.redis.init();

    this.refreshTimer = setInterval(
      this.renewIDCard.bind(this),
      this.refreshDelay);
  }

  async renewIDCard() {
    if (!this.disposed) {
      const refreshed = await this.redis.commands.pexpire(
        this.nodeIdKey,
        this.refreshDelay * 1.5);

      // Unable to refresh the key in time before it expires
      // => this node is too slow, we need to remove it from the cluster
      if (refreshed === 0) {
        await this.dispose();
        this.parentPort.postMessage({ error: 'Node too slow: ID card expired' });
      }
    }
  }

  async dispose() {
    if (!this.disposed) {
      this.disposed = true;
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      await this.redis.commands.del(this.nodeIdKey);
    }
  }
}

if (!isMainThread) {
  const idCardRenewer = new IDCardRenewer();
  parentPort.on('message', async (message) => {
    if (message.action === 'start') {
      // Simulate basic global Kuzzle Context
      global.kuzzle = { ...message.kuzzle };
      global.kuzzle.log = {
        debug: console.debug, // eslint-disable-line no-console
        error: console.error, // eslint-disable-line no-console
        info: console.info, // eslint-disable-line no-console
        warn: console.warn, // eslint-disable-line no-console
      };
      
      idCardRenewer.init(message);
    } else if (message.action === 'dispose') {
      idCardRenewer.dispose();
    }
  });  
}

module.exports = IDCardRenewer;
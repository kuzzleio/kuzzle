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

const Bluebird = require('bluebird');
const debug = require('debug')('kuzzle:cluster');
const debugNotify = require('debug')('kuzzle:cluster:notify');
const debugSync = require('debug')('kuzzle:cluster:sync');
const debugHeartbeat = require('debug')('kuzzle:cluster:heartbeat');
const zeromq = require('zeromq');
const {
  Request,
  InternalError: KuzzleInternalError,
} = require('kuzzle-common-objects');

const RedisStateManager = require('./redis/manager');

class Node {
  constructor (context) {
    this.context = context;

    this.uuid = null;

    this.ready = false;

    this.sockets = {
      pub: zeromq.socket('pub'),
      sub: zeromq.socket('sub'),
      router: zeromq.socket('router')
    };

    this.sockets.router.on('message', (envelope, binary) => {
      this._onRouterMessage(envelope, binary)
        .catch(e => {
          this.context.log('error', `Error occured when processing the envelope: ${envelope}`);
          this.context.log('error', e.stack);
        });
    });
    this.sockets.sub.on('message', binary => this._onSubMessage(binary));
    this.sockets.sub.subscribe('');

    // active node pool
    this.pool = {};

    this.state = new RedisStateManager(this);

    this.heartbeatTimer = null;
  }

  get config () {
    return this.context.config;
  }

  get redis () {
    return this.context.redis;
  }

  get kuzzle () {
    return this.context.kuzzle;
  }

  /**
   * Brodcasts data to all other nodes in the cluster
   *
   * @param {string} room - the cluster room/channel to which send the message
   * @param {object} data
   */
  broadcast (room, data) {
    return sendPromise(this.sockets.pub, JSON.stringify([ room, data ]));
  }

  /**
   * Updates and retrieves the cluster topology
   */
  discover () {
    debug('discover %s', this.config.bindings.pub.href);

    return this.redis
      .sadd('cluster:discovery', JSON.stringify({
        pub: this.config.bindings.pub.href,
        router: this.config.bindings.router.href
      }))
      .then(() => this.redis.smembers('cluster:discovery'))
      .then(members => {
        for (const serialized of members) {
          this._addNode(JSON.parse(serialized));
        }

        // we are the first node to join. Clean up the db
        if (Object.keys(this.pool).length === 0) {
          debug('%s first node in the cluster - reset', this.config.bindings.pub.href);
          return this.state.reset()
            .then(() => this.broadcast('cluster:sync', {event: 'state:all'}));
        }

      });
  }

  init () {
    this.uuid = this.context.uuid;

    return Bluebird.all([
      Bluebird.promisify(this.sockets.pub.bind, {context: this.sockets.pub})(this.config.bindings.pub.href),
      Bluebird.promisify(this.sockets.router.bind, {context: this.sockets.router})(this.config.bindings.router.href)
    ])
      .then(() => {
        // We need some way to clear the timer, if needs be.
        // Currently only used by tests for clean exits
        this.heartbeatTimer = setInterval(
          () => this._heartbeat(),
          this.config.timers.heartbeat);

        return this.join();
      });
  }

  /**
   * Join the cluster
   *
   * @param {number} attempts
   */
  join (attempts = 1) {
    if (this.ready) {
      debug('join - already in. skipping');
      return;
    }

    debug(`join - attempt: ${attempts}`);
    return this.discover()
      .then(() => {
        const promises = [];

        for (const k of Object.keys(this.pool)) {
          const node = this.pool[k];
          promises.push(this._remoteSub(node));
        }
        return Bluebird.all(promises);
      })
      .then(() => this.state.syncAll())
      .then(() => {
        if (Object.keys(this.pool).length +1 >= this.config.minimumNodes) {
          debug('ready');
          this.ready = true;
          return this.broadcast('cluster:ready', this);
        }

        // did not join or corum not reached, retry
        if (attempts >= this.config.retryJoin) {
          return;
        }

        return Bluebird.delay(this.config.timers.joinAttemptInterval)
          .then(() => this.join(attempts + 1));
      });
  }

  /**
   * Processes incoming sync request from other node
   *
   * @param {object} data
   * @returns {*}
   * @private
   */
  sync (data) {
    if (data.event !== 'state') {
      debugSync('%o', data);
    }

    switch (data.event) {
      case 'storage:cache:add':
        return this.kuzzle.ask(
          `core:storage:${data.scope}:cache:add`,
          data.index,
          data.collection);
      case 'storage:cache:remove':
        return this.kuzzle.ask(
          `core:storage:${data.scope}:cache:remove`,
          data.index,
          data.collection);
      case 'profile':
        return this.kuzzle.ask('core:security:profile:invalidate', data.id);
      case 'role':
        return this.kuzzle.ask('core:security:role:invalidate', data.id);
      case 'strategies':
        return this.redis.hgetall('cluster:strategies')
          .then(response => {
            const currentStrategies = new Set(this.kuzzle.pluginsManager.listStrategies());

            const strategies = response || {};

            for (const name of Object.keys(strategies)) {
              currentStrategies.delete(name);
              const payload = JSON.parse(strategies[name]);

              debug('strategy:add: %s, %o', name, payload.strategy);

              try {
                this.kuzzle.pluginsManager.registerStrategy(payload.plugin, name, payload.strategy);
              }
              catch (e) {
                // log & discard
                this.context.log('error', `Plugin ${payload.plugin} - tried to add strategy "${name}": ${e.message}`);
              }
            }
            // delete strategies
            for (const name of currentStrategies) {
              debug('strategy:del: %s', name);
              const strategy = this.kuzzle.pluginsManager.strategies[name];
              if (strategy) {
                this.kuzzle.pluginsManager.unregisterStrategy(strategy.owner, name);
              }
            }
          });
      case 'state':
        return this.state.sync(data);
      case 'state:all':
        return this.state.syncAll(data);
      case 'state:reset':
        return this.context.reset();
      case 'validators':
        return this.kuzzle.validation.curateSpecification();
      default:
        return Bluebird.reject(
          new KuzzleInternalError(`Unknown sync event received: ${data.event}, ${JSON.stringify(data, undefined, 2)}`)
        );
    }

    return Bluebird.resolve();
  }

  toJSON () {
    return {
      uuid: this.uuid,
      pub: this.config.bindings.pub.href,
      router: this.config.bindings.router.href,
      ready: this.ready
    };
  }

  /**
   * Add a cluster node to the list of known siblings
   *
   * @param {object} node
   * @private
   */
  _addNode (node) {
    if (node.pub === this.config.bindings.pub.href) {
      return;
    }

    this.context.log('info', `adding node ${JSON.stringify(node)}`);

    if (this.pool[node.pub]) {
      this.context.log('warn', `[_addNode] node already known ${JSON.stringify(node)}`);
      return;
    }

    this.sockets.sub.connect(node.pub);
    this.pool[node.pub] = node;
    this._onHeartbeat(node);
  }

  _heartbeat () {
    this.broadcast('cluster:heartbeat', this);

    return this.redis.smembers('cluster:discovery')
      .then(members => {
        let found = false;

        for (const serialized of members) {
          const member = JSON.parse(serialized);

          if (member.router === this.config.bindings.router.href) {
            found = true;
            break;
          }
        }

        if (!found) {
          return this.join();
        }
      });
  }

  /**
   * Called on heartbeat reception from another node
   *
   * @param {object} node
   * @private
   */
  _onHeartbeat (remoteNode) {
    const node = this.pool[remoteNode.pub];

    if (!node) {
      return this._remoteJoin(remoteNode);
    }

    clearTimeout(node.heartbeat);
    node.heartbeat = setTimeout(() => {
      this.context.log('warn', `[cluster] no heartbeat received in time for ${node.pub}. removing node`);
      this._removeNode(node.pub);

      // send a rejoin request to lost node in case this is a temp issue
      // (overload/network congestion..)
      this._remoteJoin(remoteNode);
    }, this.config.timers.heartbeat * 2);
  }

  /**
   * 1 to 1 message received
   *
   * @param {Buffer} envelope
   * @param {buffer} buffer
   * @private
   */
  _onRouterMessage (envelope, buffer) {
    const [action, data] = JSON.parse(buffer);

    debug('[router][%s] %o', action, data);

    // called from a client to force current node to subscribe to it
    if (action === 'remoteSub') {
      if (!this.pool[data.pub]) {
        this._addNode(data);
      }

      return sendPromise(this.sockets.router, [
        envelope,
        JSON.stringify(['remoteSub', true])
      ]);
    }

    // called from a client to force rejoin, for instance if a heartbeat is
    // received back
    if (action === 'remoteJoin') {
      this.ready = false;
      return sendPromise(this.sockets.router, [
        envelope,
        JSON.stringify(['remoteJoin', true])
      ])
        .then(() => this.join());
    }

    return Bluebird.reject(new Error(`Unknown router action "${action}`));
  }

  /**
   * Broadcasted (pub/sub) message received
   *
   * @param {Buffer} buffer
   * @private
   */
  async _onSubMessage (buffer) {
    const [room, data] = JSON.parse(buffer);

    if (room === 'cluster:heartbeat') {
      debugHeartbeat('Heartbeat from: %s', data.pub);
      this._onHeartbeat(data);
      return;
    }

    if (room === 'cluster:notify:document') {
      debugNotify('doc %o', data);
      return this.kuzzle.ask(
        'core:realtime:document:dispatch',
        data.rooms,
        new Request(data.request.data, data.request.options),
        data.scope,
        data.action,
        data.content);
    }

    if (room === 'cluster:notify:user') {
      debugNotify('user %o', data);
      return this.kuzzle.ask(
        'core:realtime:user:sendMessage',
        data.room,
        new Request(data.request.data, data.request.options),
        data.scope,
        data.content);
    }

    if (room === 'cluster:sync') {
      this.sync(data);
      return;
    }

    debug('[sub][%s] %o', room, data);

    if (room === 'cluster:ready') {
      if (data.pub !== this.uuid && !this.pool[data.pub]) {
        // an unknown node is marked as ready, we are not anymore
        this.context.log('warn', `[cluster] unknown node ready: ${data.pub}`);

        this.ready = false;
        this._addNode(data);
        await Bluebird.delay(500);
        return this.join();
      }

      this.pool[data.pub].ready = true;
    }
    else if (room === 'cluster:remove') {
      this._removeNode(data.pub);
    }
    else if (room === 'cluster:admin:dump') {
      this.kuzzle.janitor.dump(data.suffix);
    }
    else if (room === 'cluster:admin:shutdown') {
      process.kill(process.pid, 'SIGTERM');
    }
    else if (room === 'cluster:admin:resetSecurity') {
      await this.kuzzle.ask('core:security:profile:invalidate');
      await this.kuzzle.ask('core:security:role:invalidate');
    }
  }

  /**
   * ask {node} to rejoin the cluster
   *
   * @param {node} node
   * @returns {Promise}
   * @private
   */
  _remoteJoin (node) {
    const socket = zeromq.socket('dealer');
    socket.connect(node.router);

    let resolve;
    const deferred = new Bluebird(r => {
      resolve = r;
    });

    socket.on('message', buffer => {
      const [action] = JSON.parse(buffer);

      if (action === 'remoteJoin') {
        socket.close();
        this.discover();
        resolve();
      }
    });

    return sendPromise(socket, JSON.stringify(['remoteJoin', this]))
      .then(() => deferred)
      .timeout(this.config.timers.discoverTimeout)
      .catch(e => {
        // we cannot handle the error and do not want to throw. Just log.
        this.context.log('error', `_remoteJoin: timeout or unhandled exception ${JSON.stringify(e)}`);
      });
  }

  /**
   * ask {node} to subscribe to us
   *
   * @param {node} node
   * @private
   */
  _remoteSub (node) {
    const socket = zeromq.socket('dealer');
    socket.connect(node.router);

    let resolve;
    const deferred = new Bluebird(r => {
      resolve = r;
    });

    socket.on('message', buffer => {
      const
        [action] = JSON.parse(buffer);

      if (action === 'remoteSub') {
        socket.close();
        resolve();
      }
    });

    return sendPromise(socket, JSON.stringify(['remoteSub', this ]))
      .then(() => deferred)
      .timeout(this.config.timers.discoverTimeout)
      .catch(e => {
        if (e instanceof Bluebird.TimeoutError) {
          return this._removeNode(node.pub);
        }
        throw e;
      });
  }

  /**
   * Removes a sibling node from the pool
   *
   * @param {string} nodePub
   * @private
   */
  _removeNode (nodePub) {
    debug(`[_removeNode] ${nodePub}`);
    const node = this.pool[nodePub];

    if (!node) {
      return;
    }

    clearTimeout(node.heartbeat);
    this.sockets.sub.disconnect(node.pub);
    delete this.pool[nodePub];

    return this.context.cleanNode(node)
      .then(() => this.state.syncAll({}))
      .then(() => {
        if (Object.keys(this.pool).length + 1 < this.config.minimumNodes) {
          this.context.log('warn', '[cluster] not enough nodes to run. killing myself');
          this.ready = false;
          this.broadcast('cluster:remove', this);
          return this.join();
        }
      });
  }
}

function sendPromise (socket, payload) {
  return new Bluebird(resolve => socket.send(payload, 0, resolve));
}

module.exports = Node;

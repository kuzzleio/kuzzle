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

const fs = require('fs');
const path = require('path');
const url = require('url');

const Bluebird = require('bluebird');
const debug = require('debug')('kuzzle:cluster');
const ip = require('ip');
const { v4: uuid } = require('uuid');
const IORedis = require('ioredis');
const { Request } = require('kuzzle-common-objects');

const Node = require('./node');

IORedis.Promise = Bluebird;

class KuzzleCluster {

  /**
   * @constructor
   */
  constructor () {
    this.config = null;
    this.context = null;
    this.kuzzle = null;
    this.uuid = null;
    this.node = null;

    this.hooks = {
      'core:kuzzleStart': 'kuzzleStarted',
      'core:indexCache:add': 'indexCacheAdded',
      'core:indexCache:remove': 'indexCacheRemoved',
      'core:notify:document': 'notifyDocument',
      'core:notify:user': 'notifyUser',
      'core:profileRepository:save': 'profileUpdated',
      'core:profileRepository:delete': 'profileUpdated',
      'core:roleRepository:save': 'roleUpdated',
      'core:roleRepository:delete': 'roleUpdated',
      'collection:afterUpdateSpecifications': 'refreshSpecifications',
      'collection:afterDeleteSpecifications': 'refreshSpecifications',
      'core:realtime:room:create:after': 'roomCreated',
      'admin:afterResetSecurity': 'resetSecurityCache',
      'admin:afterDump': 'dump',
      'admin:afterShutdown': 'shutdown'
    };

    this.pipes = {
      'core:auth:strategyAdded': 'strategyAdded',
      'core:auth:strategyRemoved': 'strategyRemoved',
      'core:realtime:user:subscribe:after': 'subscriptionAdded',
      'core:realtime:user:unsubscribe:after': 'subscriptionOff',
      'core:realtime:user:join:after': 'subscriptionJoined',
      'realtime:beforeJoin': 'beforeJoin',
      'core:realtime:room:remove:before': 'removeRoom',
    };

    this.routes = [
      {verb: 'get', url: '/health', controller: 'cluster', action: 'health'},
      {verb: 'post', url: '/reset', controller: 'cluster', action: 'reset'},
      {verb: 'get', url: '/status', controller: 'cluster', action: 'status'}
    ];

    this.controllers = {
      cluster: {
        health: 'clusterHealthAction',
        reset: 'clusterResetAction',
        status: 'clusterStatusAction'
      }
    };

    this.node = null;

    this._isKuzzleStarted = false;

    this._rooms = {
      // Map.<room id, room>
      flat: new Map(),
      // Map.<index, Map.<collection, Set.<room id> > >
      tree: new Map()
    };

    this._shutdown = false;
  }

  /**
   * @param {object} config
   * @param {PluginContext} context
   * @returns {KuzzleCluster}
   */
  init (config, context) {
    this.context = context;
    this.kuzzle = context.accessors.kuzzle;

    const mergedConfig = Object.assign({
      bindings: {
        pub: 'tcp://[_site_:ipv4]:7511',
        router: 'tcp://[_site_:ipv4]:7510'
      },
      minimumNodes: 1,
      redis: this.kuzzle.config.services.internalCache.nodes
        || this.kuzzle.config.services.internalCache.node,
      retryJoin: 30,
      timers: {
        discoverTimeout: 3000,
        joinAttemptInterval: 1000,
        heartbeat: 5000,
        waitForMissingRooms: 500
      }
    }, config || {});

    mergedConfig.bindings.pub = this.constructor._resolveBinding(
      mergedConfig.bindings.pub,
      7511);
    mergedConfig.bindings.router = this.constructor._resolveBinding(
      mergedConfig.bindings.router,
      7510);

    this.config = mergedConfig;

    this._registerShutdownListeners();

    this.uuid = uuid();

    this.redis = Array.isArray(this.config.redis)
      ? new IORedis.Cluster(this.config.redis)
      : new IORedis(this.config.redis);

    this.redis.defineCommand('clusterCleanNode', {
      numberOfKeys: 1,
      lua: fs.readFileSync(path.resolve(__dirname, 'redis/cleanNode.lua'))
    });
    this.redis.defineCommand('clusterState', {
      numberOfKeys: 1,
      lua: fs.readFileSync(path.resolve(__dirname, 'redis/getState.lua'))
    });
    this.redis.defineCommand('clusterSubOn', {
      numberOfKeys: 1,
      lua: fs.readFileSync(path.resolve(__dirname, 'redis/subon.lua'))
    });
    this.redis.defineCommand('clusterSubOff', {
      numberOfKeys: 1,
      lua: fs.readFileSync(path.resolve(__dirname, 'redis/suboff.lua'))
    });

    this.node = new Node(this);
  }

  // --------------------------------------------------------------------------
  // hooks
  // --------------------------------------------------------------------------

  /**
   * @param {Request} request
   * @param {function} cb callback
   * @param {integer} attempts
   */
  beforeJoin (request, cb, attempts = 0) {
    if (!request.input.body || !request.input.body.roomId) {
      return cb(null, request);
    }

    const roomId = request.input.body.roomId;
    const room = this._rooms.flat.get(roomId);

    if (room) {
      return this.kuzzle
        .ask('core:realtime:room:create', room.index, room.collection, roomId)
        .then(() => cb(null, request))
        .catch(e => cb(e));
    }

    // room not found. May be normal but can also be due to cluster state
    // propagation delay
    if (attempts > 0) {
      return cb(null, request);
    }

    setTimeout(
      () => this.beforeJoin(request, cb, attempts + 1),
      this.config.timers.joinAttemptInterval);
  }

  /**
   * Hook for core:indexCache:add
   *
   * @param {Object} payload - { index, collection, scope }
   */
  indexCacheAdded (payload) {
    if (!this.node.ready) {
      debug('[%s][warning] could not broadcast "index cache added" action: node not connected to cluster', this.uuid);
      return;
    }

    this.node.broadcast('cluster:sync', {
      event: 'indexCache:add',
      ...payload
    });
  }

  /**
   * Hook for core:indexCache:remove
   *
   * @param {Object} payload - { index, collection, scope }
   */
  indexCacheRemoved (payload) {
    if (!this.node.ready) {
      debug('[%s][warning] could not broadcast "index cache removed" action: node not connected to cluster', this.uuid);
      return;
    }

    this.node.broadcast('cluster:sync', {
      event: 'indexCache:remove',
      ...payload,
    });
  }

  kuzzleStarted () {
    // kuzzle realtime overrides
    {
      const realtimeController = this.kuzzle.funnel.controllers.get('realtime');

      realtimeController.count = request => this._realtimeCountOverride(request);
      realtimeController.list = request => this._realtimeListOverride(request);
    }

    // register existing strategies
    const promises = [];
    for (const name of this.kuzzle.pluginsManager.listStrategies()) {
      const strategy = this.kuzzle.pluginsManager.strategies[name];

      promises.push(
        this.redis.hset(
          'cluster:strategies',
          name,
          JSON.stringify({
            plugin: strategy.owner,
            strategy: strategy.strategy
          })));
    }

    return Bluebird.all(promises)
      .then(() => {
        this._isKuzzleStarted = true;
        return this.node.init();
      });
  }

  notifyDocument (data) {
    if (!this.node.ready) {
      debug('[%s][warning] could not broadcast document notification: node not connected to cluster', this.uuid);
      return;
    }

    this.node.broadcast('cluster:notify:document', data);
  }

  notifyUser (data) {
    if (!this.node.ready) {
      debug('[%s][warning] could not broadcast user notification: node not connected to cluster', this.uuid);
      return;
    }

    this.node.broadcast('cluster:notify:user', data);
  }

  /**
   * @param {object} diff
   */
  profileUpdated (diff) {
    if (!this.node.ready) {
      debug('[%s][warning] could not broadcast "profile update" action: node not connected to cluster', this.uuid);
      return;
    }

    this.node.broadcast('cluster:sync', {
      event: 'profile',
      id: diff._id
    });
  }

  refreshSpecifications () {
    if (!this.node.ready) {
      debug('[%s][warning] could not broadcast "refresh specifications" action: node not connected to cluster', this.uuid);
      return;
    }

    this.node.broadcast('cluster:sync', {
      event: 'validators'
    });
  }

  /**
   * @param {object} diff
   */
  roleUpdated (diff) {
    if (!this.node.ready) {
      debug('[%s][warning] could not broadcast "role update" action: node not connected to cluster', this.uuid);
      return;
    }

    this.node.broadcast('cluster:sync', {
      event: 'role',
      id: diff._id
    });
  }

  roomCreated (payload) {
    this.node.state.locks.create.add(payload.roomId);
  }

  async removeRoom (roomId) {
    this.node.state.locks.delete.add(roomId);
    const room = this._rooms.flat.get(roomId);

    if (room && room.count > 1) {
      throw new Error('cannot remove: still used by other nodes');
    }

    return roomId;
  }

  strategyAdded (payload) {
    if (!this.node.ready) {
      debug('[%s][warning] could not broadcast "strategy added" action: node not connected to cluster', this.uuid);
      return Bluebird.resolve(payload);
    }

    return this.redis
      .hset('cluster:strategies', payload.name, JSON.stringify({
        plugin: payload.pluginName,
        strategy: payload.strategy
      }))
      .then(() => this.node.broadcast('cluster:sync', {event: 'strategies'}))
      .then(() => payload);
  }

  strategyRemoved (payload) {
    if (!this.node.ready) {
      debug('[%s][warning] could not broadcast "strategy added" action: node not connected to cluster', this.uuid);
      return Bluebird.resolve(payload);
    }

    return this.redis.hdel('cluster:strategies', payload.name)
      .then(() => this.node.broadcast('cluster:sync', {event: 'strategies'}))
      .then(() => payload);
  }

  async subscriptionAdded (diff) {
    if (!this.node.ready) {
      debug(
        '[%s][warning] could not broadcast "subscription added" action: node not connected to cluster',
        this.uuid);
      return diff;
    }

    const {
      index,
      collection,
      filters,
      roomId,
      connectionId
    } = diff;
    const filter = {index, collection, filters};
    const serializedFilter = filters && JSON.stringify(filter) || 'none';

    debug('[hook] sub add %s/%s', roomId, connectionId);

    try {
      const result = await this.redis.clusterSubOn(
        `{${index}/${collection}}`,
        this.uuid,
        roomId,
        connectionId,
        serializedFilter);

      await this.redis.sadd('cluster:collections', `${index}/${collection}`);
      await this._onSubOn('add', index, collection, roomId, result);
      return diff;
    }
    finally {
      this.node.state.locks.create.delete(roomId);
    }
  }

  subscriptionJoined (diff) {
    if (!this.node.ready) {
      debug('[%s][warning] could not broadcast "subscription joined" action: node not connected to cluster', this.uuid);
      return Bluebird.resolve(diff);
    }

    const
      {
        index,
        collection,
        roomId,
        connectionId
      } = diff;

    if (diff.changed === false) {
      debug('[hook][sub joined] no change');
      return Bluebird.resolve(diff);
    }

    return this.redis
      .clusterSubOn(
        `{${index}/${collection}}`,
        this.uuid,
        roomId,
        connectionId,
        'none')
      .then(result => this._onSubOn('join', index, collection, roomId, result))
      .then(() => diff);
  }

  async subscriptionOff (object) {
    if (!this.node.ready) {
      debug(
        '[%s][warning] could not broadcast "subscription off" action: node not connected to cluster',
        this.uuid);
      return object;
    }

    const room = object.room;
    const {index, collection} = room;
    const connectionId = object.requestContext.connectionId;

    debug('[hook] sub off %s/%s', room.id, connectionId);

    try {
      const [version, count] = await this.redis.clusterSubOff(
        `{${index}/${collection}}`,
        this.uuid,
        room.id,
        connectionId);

      if (this.node.state.getVersion(index, collection) < version) {
        this.setRoomCount(index, collection, room.id, count);
      }

      debug(
        '[hook][sub off] v%d %s/%s/%s -%s = %d',
        version,
        index,
        collection,
        room.id,
        connectionId,
        count);

      await this.node.broadcast('cluster:sync', {
        index,
        collection,
        event: 'state',
        post: 'off',
        roomId: room.id,
      });
    }
    finally {
      this.node.state.locks.delete.delete(room.id);
    }
  }

  resetSecurityCache () {
    this.node.broadcast('cluster:admin:resetSecurity');
  }

  dump (request) {
    if (!this.node.ready) {
      debug('[%s][warning] could not broadcast "dump" action: node not connected to cluster', this.uuid);
      return;
    }

    const suffix = request.input.args.suffix || '';

    this.node.broadcast('cluster:admin:dump', { suffix });
  }

  shutdown () {
    if (!this.node.ready) {
      debug('[%s][warning] could not broadcast "shutdown" action: node not connected to cluster', this.uuid);
      return;
    }

    this.node.broadcast('cluster:admin:shutdown');
  }

  // --------------------------------------------------------------------------
  // controller actions
  // --------------------------------------------------------------------------
  clusterHealthAction () {
    if (!this.node.ready) {
      return Bluebird.reject(new this.context.errors.NotFoundError('ko'));
    }

    return Bluebird.resolve('ok');
  }

  clusterStatusAction () {
    if (!this.node.ready) {
      return Bluebird.reject(new this.context.errors.NotFoundError('ko'));
    }

    return Bluebird.resolve({
      count: 1 + Object.keys(this.node.pool).length,
      current: {
        pub: this.node.config.bindings.pub.href,
        router: this.node.config.bindings.router.href,
        ready: this.node.ready
      },
      pool: Object.keys(this.node.pool).map(k => {
        const node = this.node.pool[k];

        return {
          pub: node.pub,
          router: node.router,
          ready: node.ready
        };
      })
    });
  }

  clusterResetAction () {
    if (!this.node.ready) {
      return Bluebird.reject(new this.context.errors.NotFoundError('ko'));
    }

    return this.reset()
      .then(() => this.node.broadcast('cluster:sync', {event: 'state:reset'}))
      .then(() => 'ok');
  }

  // --------------------------------------------------------------------------
  // business
  // --------------------------------------------------------------------------
  /**
   * Removes cluster related data inserted in redis from nodeId
   *
   * @param {string} nodeId
   */
  cleanNode (node) {
    const promises = [];

    return this.redis
      .srem('cluster:discovery', JSON.stringify({
        pub: node.pub,
        router: node.router
      }))
      .then(() => {
        if (node === this.node && Object.keys(this.node.pool).length === 0) {
          debug('last node to quit.. cleaning up');
          return this.node.state.reset();
        }

        for (const [index, collections] of this._rooms.tree.entries()) {
          for (const collection of collections.keys()) {
            promises.push(
              this.redis.clusterCleanNode(
                `{${index}/${collection}}`,
                node.uuid));
          }
        }

        return Bluebird.all(promises);
      })
      .then(() => this.node.broadcast('cluster:sync', {event: 'state:all'}));
  }

  deleteRoomCount (roomId) {
    const room = this._rooms.flat.get(roomId);
    if (!room) {
      return;
    }

    const { index, collection } = room;

    this._rooms.flat.delete(roomId);

    const
      collections = this._rooms.tree.get(index),
      rooms = collections.get(collection);

    rooms.delete(roomId);

    if (rooms.size === 0) {
      collections.delete(collection);

      if (collections.size === 0) {
        this._rooms.tree.delete(index);
      }
    }
  }

  log (level, msg) {
    if (this._isKuzzleStarted) {
      this.kuzzle.emit(`log:${level}`, msg);
    }
    else {
      // eslint-disable-next-line no-console
      console.log(`${new Date().toISOString()} [${level}] ${msg}`);
    }
  }

  reset () {
    return this.node.state.reset()
      .then(() => this.node.state.syncAll({post: 'reset'}))
      .then(() => {
        this._rooms.flat.clear();
        this._rooms.tree.clear();
      });
  }

  setRoomCount (index, collection, roomId, _count) {
    const count = parseInt(_count, 10);

    if (count === 0) {
      return this.deleteRoomCount(roomId);
    }

    const val = {
      index,
      collection,
      count
    };

    this._rooms.flat.set(roomId, val);

    let collections = this._rooms.tree.get(index);

    if (!collections) {
      collections = new Map();
      this._rooms.tree.set(index, collections);
    }

    if (!collections.has(collection)) {
      collections.set(collection, new Set());
    }

    collections.get(collection).add(roomId);
  }

  _onSubOn (type, index, collection, roomId, result) {
    const [version, count] = result;

    if (this.node.state.getVersion(index, collection) < version) {
      this.setRoomCount(index, collection, roomId, count);
    }

    debug('[hook][sub %s] v%d %s/%s/%s = %d',
      type,
      version,
      index,
      collection,
      roomId,
      count);

    return this.node.broadcast('cluster:sync', {
      index,
      collection,
      roomId,
      event: 'state',
      post: type
    });
  }

  _onShutDown (event) {
    if (this._shutdown) {
      return;
    }

    this._shutdown = true;
    this.log('warn', event + ' kuzzle is shutting down... doing our best to clean rooms');

    return this.cleanNode(this.node);
  }

  /**
   * @param {Request} request
   * @param {number} attempt
   * @private
   */
  async _realtimeCountOverride (request, attempt = 0) {
    if (!request.input.body) {
      throw new this.context.errors.BadRequestError('The request must specify a body.');
    }

    if (!Object.prototype.hasOwnProperty.call(request.input.body, 'roomId')) {
      throw new this.context.errors.BadRequestError('The request must specify a body attribute "roomId".');
    }

    const roomId = request.input.body.roomId;

    if (!this._rooms.flat.has(roomId)) {
      // no room found. May be normal but can also be due to cluster replication
      // time
      if (attempt > 0) {
        throw new this.context.errors.NotFoundError(`The room Id "${roomId}" does not exist`);
      }

      return Bluebird
        .delay(this.config.timers.waitForMissingRooms)
        .then(() => this._realtimeCountOverride(request, attempt + 1));
    }

    return {count: this._rooms.flat.get(roomId).count};
  }

  /**
   * @param {Request} request
   * @private
   */
  _realtimeListOverride (request) {
    const list = {};

    const promises = [];

    for (const [roomId, room] of this._rooms.flat.entries()) {
      promises.push(request.context.user.isActionAllowed(new Request({
        controller: 'document',
        action: 'search',
        index: room.index,
        collection: room.collection
      }), this.kuzzle)
        .then(isAllowed => {
          if (!isAllowed) {
            return;
          }

          if (!list[room.index]) {
            list[room.index] = {};
          }
          if (!list[room.index][room.collection]) {
            list[room.index][room.collection] = {};
          }
          list[room.index][room.collection][roomId] = room.count;
        })
      );
    }

    return Bluebird.all(promises)
      .then(() => {
        if (!request.input.args.sorted) {
          return list;
        }

        const sorted = {};

        for (const index of Object.keys(list).sort()) {
          if (!sorted[index]) {
            sorted[index] = {};
          }

          for (const collection of Object.keys(list[index]).sort()) {
            if (!sorted[index][collection]) {
              sorted[index][collection] = {};
            }

            for (const roomId of Object.keys(list[index][collection]).sort()) {
              sorted[index][collection][roomId] = list[index][collection][roomId];
            }
          }
        }

        return sorted;
      });
  }

  _registerShutdownListeners () {
    for (const event of [
      'uncaughtException',
      'SIGINT',
      'SIGQUIT',
      'SIGABRT',
      'SIGTERM'
    ]) {
      process.on(event, () => this._onShutDown(event));
    }

    // Crashing on an unhandled rejection is a good idea during development
    // as it helps spotting code errors. And according to the warning messages,
    // this is what Node.js will do automatically in future versions anyway.
    if (process.env.NODE_ENV === 'development') {
      process.on('unhandledRejection', () => {
        this.log('error', 'Kuzzle caught an unhandled rejected promise and will shutdown.');
        this.log('error', 'This behavior is only triggered if NODE_ENV is set to "development"');
        this._onShutDown('unhandledRejection');
      });
    }
  }

  /**
   *
   * @param {String} hostConfig The host representation as string, i.e. tcp://[eth0:ipv6]:9876
   * @param {integer} defaultPort Default port to use if none found from the config
   * @returns URL
   * @private
   */
  static _resolveBinding (hostConfig, defaultPort) {
    const parsed = url.parse(hostConfig, false, true);

    let host = parsed.hostname;

    if (/^\[.+\]/.test(parsed.host)) {
      const
        tmp = host.split(':'),
        family = tmp[1] || 'ipv4';

      if (tmp[0] === '_site_') {
        tmp[0] = 'public';
      }

      host = ip.address(tmp[0], family.toLowerCase());
    }

    return url.parse(`${parsed.protocol || 'tcp'}://${host}:${parsed.port || defaultPort}`);
  }

}

module.exports = KuzzleCluster;

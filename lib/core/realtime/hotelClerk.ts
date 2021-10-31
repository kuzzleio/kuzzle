/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

import Bluebird from 'bluebird';
import { JSONObject } from 'kuzzle-sdk';
import { Koncorde, NormalizedFilter } from 'koncorde';

import { KuzzleRequest, Request, RequestContext }  from '../../api/request';
import kerror  from '../../kerror';
import createDebug from '../../util/debug';
import {
  fromKoncordeIndex,
  getCollections,
  toKoncordeIndex,
}  from '../../util/koncordeCompat';
import { RealtimeScope, RealtimeUsers, User } from '../../types';

const realtimeError = kerror.wrap('core', 'realtime');

const debug = createDebug('kuzzle:realtime:hotelClerk');

const CHANNEL_ALLOWED_VALUES = ['all', 'in', 'out', 'none'];

/**
 * A channel define how notifications should be send for a particular realtime
 * room.
 *
 * Channels define with more granularity if a room notification should be sent:
 *  - is the document entering or leaving the scope
 *  - should I notify when users join or leave the room
 *  - should I propagate the notification to other cluster nodes
 */
class Channel {
  /**
   * Identifier of the channel.
   *
   * Result of roomId + hash(channel)
   */
  public name: string;

  /**
   * Define if notification should be send when documents are entering or leaving
   * the subscription scope.
   *
   * @default "all"
   */
  public scope: RealtimeScope;

  /**
   * Define if notification should be send when users join or leave the channel.
   *
   * @default "none"
   */
  public users: RealtimeUsers;

  /**
   * Define if the notification should be propagated on other cluster nodes or
   * only to connection subscribing on this node.
   *
   * This is used by the EmbeddedSDK realtime subscription to propagate or not
   * callback execution among other nodes.
   */
  public cluster: boolean;

  constructor (
    roomId: string,
    {
      scope='all',
      users='none',
      propagate=true,
    }: { scope?: RealtimeScope, users?: RealtimeUsers, propagate?: boolean } = {}
  ) {
    this.scope = scope;
    this.users = users;
    this.cluster = propagate;

    if (! CHANNEL_ALLOWED_VALUES.includes(this.scope) || this.scope as any === 'none') {
      throw realtimeError.get('invalid_scope');
    }

    if (! CHANNEL_ALLOWED_VALUES.includes(this.users)) {
      throw realtimeError.get('invalid_users');
    }

    this.name = `${roomId}-${global.kuzzle.hash(this)}`;
  }
}

/**
 * Represents a realtime subscription from a connection to a room
 */
class Subscription {
  public connectionId: string;
  public roomId: string;

  public index: string;
  public collection: string;
  public filters: JSONObject;

  public kuid: string;

  constructor (
    index: string,
    collection: string,
    filters: JSONObject,
    roomId: string,
    connectionId: string,
    user: { _id: string },
  ) {
    this.connectionId = connectionId;
    this.roomId = roomId;

    this.index = index;
    this.collection = collection;
    this.filters = filters;

    this.kuid = user && user._id || null;
  }
}

/**
 * List of realtime rooms and the number of connections subscribing
 *
 * @example
 * {
 *   <index>: {
 *     <collection>: {
 *       <roomId>: <number of connections>
 *     }
 *   }
 * }
 *
 */
export type RoomList = {
  [index: string]: {
    [collection: string]: {
      [roomId: string]: number
    }
  }
};

/**
 * A room represents a subscription scope made on a combination of:
 *  - index
 *  - collection
 *  - filters
 *
 * A room may contain differents channels that describe which notifications should
 * be sent. (e.g. only document leaving the scope, users joining the room)
 *
 * The rooms also contains the list of connections who subscribed to it.
 */
class Room {
  /**
   * Room unique identifier.
   *
   * Koncorde hash for the desired scope (index + collection + filters)
   */
  public id: string;
  public index: string;
  public collection: string;

  /**
   * List of connections subscribing to this room.
   */
  private customers = new Set<string>();

  /**
   * Map of channels configuration for this room.
   *
   * Map<channel, Channel>
   *
   * @example
   *
   * channels: {
   *   '<channel>': {
   *
   *     // request scope filter, default: 'all'
   *     scope: 'all|in|out|none',
   *
   *     // filter users notifications, default: 'none'
   *     users: 'all|in|out|none',
   *
   *     // should propagate notification to the cluster
   *     // (used for plugin subscriptions)
   *     cluster: true|false
   *   }
   * },
   */
  public channels = new Map<string, Channel>();

  constructor (id: string, index: string, collection: string) {
    this.id = id;
    this.index = index;
    this.collection = collection;
  }

  /**
   * Number of connections subscribing to the room
   */
  get size (): number {
    return this.customers.size;
  }

  /**
   * Creates a new configuration channel on the room if it doesn't already exists
   */
  createChannel (channel: Channel): void {
    if (this.channels.has(channel.name)) {
      return;
    }

    this.channels.set(channel.name, channel);
  }

  addConnection (connectionId: string): void {
    this.customers.add(connectionId);
  }

  removeConnection (connectionId: string): void {
    this.customers.delete(connectionId);
  }
}

/**
 * Represents a connection subscribing to a room with a set of volatile data.
 *
 * Map<roomId, volatiles>
 */
type Subscriber = Map<string, JSONObject>;

export class HotelClerk {
  private module: any;

  /**
   * Number of created rooms.
   *
   * Used with the "subscriptionRooms" configuration limit.
   */
  private roomsCount: number = 0;

  /**
   * Current realtime rooms.
   *
   * Map<roomId, Room>
   */
  private rooms = new Map<string, Room>();

  /**
   * Current connections handled by the HotelClerk.
   *
   * Each connection can be a subscriber to many rooms with different volatile data.
   */
  private customers = new Map<string, Subscriber>();

  /**
   * Shortcut to the Koncorde instance on the global object.
   */
  private koncorde: Koncorde;

  constructor (realtimeModule: any) {
    this.module = realtimeModule;

    this.koncorde = global.kuzzle.koncorde;
  }

  /**
   * Registers the ask events.
   */
  async init (): Promise<void> {
    /**
     * Create a new, empty room.
     * @param {string} index
     * @param {string} collection
     * @param {string} roomId
     * @returns {boolean} status indicating if the room was created or not
     */
    global.kuzzle.onAsk(
      'core:realtime:room:create',
      (index, collection, roomId) => this.newRoom(index, collection, roomId));

    /**
     * Joins an existing room.
     * @param  {Request} request
     * @returns {Promise}
     */
    global.kuzzle.onAsk(
      'core:realtime:join', request => this.join(request));

    /**
     * Return the list of index, collection, rooms (+ their users count)
     * on all index/collection pairs that the requesting user is allowed to
     * subscribe
     *
     * @param  {User} user
     * @return {number}
     * @throws {NotFoundError} If the roomId does not exist
     */
    global.kuzzle.onAsk('core:realtime:list', user => this.list(user));

    /**
     * Given an index, returns the list of collections having subscriptions
     * on them.
     * @param  {string} index
     * @return {Array.<string>}
     */
    global.kuzzle.onAsk(
      'core:realtime:collections:get',
      index => this.listCollections(index));

    /**
     * Removes a user and all their subscriptions.
     * @param  {string} connectionId
     */
    global.kuzzle.onAsk(
      'core:realtime:user:remove',
      connectionId => this.removeUser(connectionId));

    /**
     * Adds a new user subscription
     * @param  {Request} request
     * @return {Object|null}
     */
    global.kuzzle.onAsk(
      'core:realtime:subscribe',
      request => this.subscribe(request));

    /**
     * Unsubscribes a user from a room
     * @param {string} connectionId
     * @param {string} roomId
     * @param {string} kuid
     * @param {boolean} [notify]
     */
    global.kuzzle.onAsk(
      'core:realtime:unsubscribe',
      (connectionId, roomId, notify) => {
        return this.unsubscribe(connectionId, roomId, notify);
      });
  }

  /**
   * Subscribe a connection to a realtime room.
   *
   * The room will be created if it does not already exists.
   *
   * Notify other subscribers on this room about this new subscription
   *
   * @throws Throws if the user has already subscribed to this room name
   *         (just for rooms with same name, there is no error if the room
   *         has a different name with same filter) or if there is an error
   *         during room creation
   */
  async subscribe (request: KuzzleRequest): Promise<{ channel: string, roomId: string }> {
    const { index, collection } = request.input.resource;

    if (! index) {
      return kerror.reject('api', 'assert', 'missing_argument', 'index');
    }

    if (! collection) {
      return kerror.reject('api', 'assert', 'missing_argument', 'collection');
    }

    /*
     * /!\ This check is a duplicate to the one already made by the
     * funnel controller. THIS IS INTENTIONAL.
     *
     * This is to prevent subscriptions to be made on dead
     * connections. And between the funnel and here, there is
     * time for a connection to drop, so while the check
     * on the funnel is useful for many use cases, this one
     * is made on the very last moment and is essential to ensure
     * that no zombie subscription can be performed
     */
    if (! global.kuzzle.router.isConnectionAlive(request.context)) {
      return null;
    }

    let normalized: NormalizedFilter;

    try {
      normalized = this.koncorde.normalize(
        request.input.body,
        toKoncordeIndex(index, collection));
    }
    catch (e) {
      throw kerror.get('api', 'assert', 'koncorde_dsl_error', e.message);
    }

    this.createRoom(normalized);

    const { channel, subscribed } = await this.subscribeToRoom(
      normalized.id,
      request);

    if (subscribed) {
      global.kuzzle.emit('core:realtime:subscribe:after', normalized.id);

      // @deprecated -- to be removed in next major version
      // we have to recreate the old "diff" object
      await global.kuzzle.pipe('core:hotelClerk:addSubscription', {
        changed: subscribed,
        collection,
        connectionId: request.context.connection.id,
        filters: normalized.filter,
        index,
        roomId: normalized.id,
      });
    }

    const subscription = new Subscription(
      index,
      collection,
      request.input.body,
      normalized.id,
      request.context.connection.id,
      request.context.user);

    global.kuzzle.emit('core:realtime:user:subscribe:after', subscription);

    return {
      channel,
      roomId: normalized.id,
    };
  }

  /**
   * Returns the list of collections of an index with realtime rooms.
   */
  listCollections (index: string): string[] {
    return getCollections(this.koncorde, index);
  }

  /**
   * Joins an existing realtime room.
   *
   * The room may exists on another cluster node, if it's the case, the normalized
   * filters will be fetched from the cluster.
   */
  async join (request: KuzzleRequest): Promise<{ roomId, channel }> {
    const roomId = request.input.body.roomId;

    if (! this.rooms.has(roomId)) {
      const normalized: NormalizedFilter = await global.kuzzle.ask(
        'cluster:realtime:filters:get',
        roomId);

      if (! normalized) {
        throw realtimeError.get('room_not_found', roomId);
      }

      this.createRoom(normalized);
    }

    const { channel, cluster, subscribed } = await this.subscribeToRoom(roomId, request);

    if (cluster && subscribed) {
      global.kuzzle.emit('core:realtime:subscribe:after', roomId);
    }

    return {
      roomId,
      channel,
    };
  }

  /**
   * Return the list of index, collection, rooms and subscribing connections
   * on all index/collection pairs that the requesting user is allowed to
   * subscribe.
   */
  async list (user: User): Promise<RoomList> {
    // We need the room list from the cluster's full state, NOT the one stored
    // in Koncorde: the latter also contains subscriptions created by the
    // framework (or by plugins), and we don't want those to appear in the API
    const fullStateRooms: RoomList = await global.kuzzle.ask('cluster:realtime:room:list');

    const isAllowedRequest = new KuzzleRequest({
      action: 'subscribe',
      controller: 'realtime',
    }, {});

    for (const [index, collections] of Object.entries(fullStateRooms)) {
      isAllowedRequest.input.resource.index = index;

      const toRemove = await Bluebird.filter(
        Object.keys(collections),
        collection => {
          isAllowedRequest.input.resource.collection = collection;

          return ! user.isActionAllowed(isAllowedRequest);
        });

      for (const collection of toRemove) {
        delete fullStateRooms[index][collection];
      }
    }

    return fullStateRooms;
  }

  /**
   * Removes a connections and unsubscribe it from every subscribed rooms.
   *
   * Usually called when an user has been disconnected from Kuzzle.
   */
  async removeUser (connectionId: string): Promise<void> {
    const customer = this.customers.get(connectionId);

    if (! customer) {
      // No need to raise an error if the connection has already been cleaned up
      return;
    }

    await Bluebird.map(customer.keys(), (roomId: string) => (
      this.unsubscribe(connectionId, roomId).catch(global.kuzzle.log.error)
    ));
  }

  /**
   * Associate the room to the connection id in this.clients
   * Allow to manage later disconnection and delete socket/rooms/...
   */
  private addRoomForCustomer (connectionId: string, roomId: string, volatile: JSONObject): void {
    debug('Add room %s for customer %s', roomId, connectionId);

    let customer = this.customers.get(connectionId);

    if (! customer) {
      customer = new Map<string, Subscriber>();
      this.customers.set(connectionId, customer);
    }

    customer.set(roomId, volatile);

    this.rooms.get(roomId).addConnection(connectionId);
  }

  /**
   * Create new room if needed
   *
   * @returns {void}
   */
  private createRoom (normalized: NormalizedFilter): void {
    const { index: koncordeIndex, id: roomId } = normalized;
    const { index, collection } = fromKoncordeIndex(koncordeIndex);

    if (this.rooms.has(normalized.id)) {
      return;
    }

    const roomsLimit = global.kuzzle.config.limits.subscriptionRooms;

    if (roomsLimit > 0 && this.roomsCount >= roomsLimit) {
      throw realtimeError.get('too_many_rooms');
    }

    this.koncorde.store(normalized);

    global.kuzzle.emit('core:realtime:room:create:after', normalized);

    // @deprecated -- to be removed in the next major version of kuzzle
    global.kuzzle.emit('room:new', { collection, index, roomId });

    /*
      In some very rare cases, the room may have been created between
      the beginning of the function executed at the end of normalize,
      and this one

      Before incrementing the rooms count, we have to make sure this
      is not the case to ensure our counter is right
      */
    if (this.newRoom(index, collection, roomId)) {
      this.roomsCount++;
    }
  }

  /**
   * Remove a connection from a room.
   *
   * Also delete the rooms if it was the last connection subscribing to it.
   *
   */
  async unsubscribe (connectionId: string, roomId: string, notify = true) {
    const customer = this.customers.get(connectionId);
    const requestContext = new RequestContext({
      connection: { id: connectionId }
    });

    if (! customer) {
      throw realtimeError.get('not_subscribed', connectionId, roomId);
    }

    const volatile = customer.get(roomId);

    if (volatile === undefined) {
      throw realtimeError.get('not_subscribed', connectionId, roomId);
    }

    if (customer.size > 1) {
      customer.delete(roomId);
    }
    else {
      this.customers.delete(connectionId);
    }

    const room = this.rooms.get(roomId);

    if (! room) {
      global.kuzzle.log.error(`Cannot remove room "${roomId}": room not found`);
      throw realtimeError.get('room_not_found', roomId);
    }

    for (const channel of Object.keys(room.channels)) {
      global.kuzzle.entryPoint.leaveChannel(channel, connectionId);
    }

    room.removeConnection(connectionId);

    if (room.size === 0) {
      await this.removeRoom(roomId);
    }

    // even if the room is deleted for this node, another one may need the
    // notification
    const request = new Request(
      {
        action: 'unsubscribe',
        collection: room.collection,
        controller: 'realtime',
        index: room.index,
        volatile,
      },
      requestContext);

    await this.module.notifier.notifyUser(roomId, request, 'out', { count: room.size });

    // Do not send an unsubscription notification if the room has been destroyed
    // @todo Why ?
    if ( notify
      && this.rooms.has(roomId)
      && Object.keys(room.channels).length > 0
    ) {
      await global.kuzzle.pipe('core:realtime:unsubscribe:after', roomId);

      // @deprecated -- to be removed in next major version
      await global.kuzzle.pipe('core:hotelClerk:removeRoomForCustomer', {
        requestContext,
        room: {
          collection: room.collection,
          id: roomId,
          index: room.index,
        },
      });
    }

    const kuid = global.kuzzle.tokenManager.getKuidFromConnection(connectionId);

    const subscription = new Subscription(
      room.index,
      room.collection,
      undefined,
      roomId,
      connectionId,
      { _id: kuid });

    global.kuzzle.emit('core:realtime:user:unsubscribe:after', {
      /* @deprecated */
      requestContext,
      /* @deprecated */
      room: {
        collection: room.collection,
        id: roomId,
        index: room.index,
      },
      subscription,
    });
  }

  /**
   * Deletes a room if no user has subscribed to it, and removes it also from the
   * real-time engine
   */
  private async removeRoom (roomId: string): Promise<void> {
    this.roomsCount--;
    this.rooms.delete(roomId);

    // @deprecated -- to be removed in the next major version
    try {
      await global.kuzzle.pipe('room:remove', roomId);
    }
    catch (e) {
      return;
    }

    // We have to ask the cluster to dispatch the room removal event.
    // The cluster will also remove the room from Koncorde if no other node
    // uses it.
    // (this node may have no subscribers on it, but other nodes might)
    await global.kuzzle.ask('cluster:realtime:room:remove', roomId);
  }

  /**
   * Subscribes a connection to an existing room.
   *
   * The subscription is made on a configuration channel who will be created
   * on the room if it does not already exists.
   *
   */
  private async subscribeToRoom (
    roomId: string,
    request: KuzzleRequest
  ): Promise<{ channel: string, cluster: boolean, subscribed: boolean }> {
    let subscribed = false;
    let notifyPromise;

    const { scope, users, propagate } = request.input.args;
    const connectionId = request.context.connection.id;

    const channel = new Channel(roomId, { scope, users, propagate });
    const customer = this.customers.get(connectionId);
    const room = this.rooms.get(roomId);

    if (! customer || ! customer.has(roomId)) {
      subscribed = true;
      this.addRoomForCustomer(connectionId, roomId, request.input.volatile);

      notifyPromise = this.module.notifier.notifyUser(
        roomId,
        request,
        'in',
        { count: room.size });
    }
    else {
      notifyPromise = Bluebird.resolve();
    }

    global.kuzzle.entryPoint.joinChannel(channel.name, connectionId);

    room.createChannel(channel);

    await notifyPromise;

    return {
      channel: channel.name,
      cluster: channel.cluster,
      subscribed,
    };
  }

  /**
   * Return the rooms a user has subscribed to.
   * @param  {connectionId} connectionId
   * @returns {Array.<string>}
   */
  getUserRooms (connectionId) {
    const rooms = this.customers.get(connectionId);

    if (rooms) {
      return Array.from(rooms.keys());
    }

    return [];
  }

  /**
   * Create an empty room in the RAM cache if it doesn't exists
   *
   * @returns True if a new room has been created
   */
  private newRoom (index: string, collection: string, roomId: string): boolean {
    if (! this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Room(roomId, index, collection));

      return true;
    }

    return false;
  }
}

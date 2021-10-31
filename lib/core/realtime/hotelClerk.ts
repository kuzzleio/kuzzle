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

import Bluebird from 'bluebird';
import { JSONObject } from 'kuzzle-sdk';
import { Koncorde, NormalizedFilter } from 'koncorde';

import { KuzzleRequest, Request, RequestContext } from '../../api/request';
import kerror from '../../kerror';
import createDebug from '../../util/debug';
import {
  fromKoncordeIndex,
  getCollections,
  toKoncordeIndex,
} from '../../util/koncordeCompat';
import { User, RoomList } from '../../types';
import { Channel } from './channel';
import { ConnectionRooms } from './connectionRooms';
import { Room } from './room';
import { Subscription } from './subscription';

const realtimeError = kerror.wrap('core', 'realtime');

const debug = createDebug('kuzzle:realtime:hotelClerk');

export class HotelClerk {
  private module: any;

  /**
   * Number of created rooms.
   *
   * Used with the "subscriptionRooms" configuration limit.
   */
  private roomsCount = 0;

  /**
   * Current realtime rooms.
   *
   * Map<roomId, Room>
   */
  private rooms = new Map<string, Room>();

  /**
   * Current subscribing connections handled by the HotelClerk.
   *
   * Each connection can subscribe to many rooms with different volatile data.
   *
   * Map<connectionId, ConnectionRooms>
   */
  private subscriptions = new Map<string, ConnectionRooms>();

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
      'core:realtime:connection:remove',
      connectionId => this.removeConnection(connectionId));

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
      channel,
      roomId,
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
  async removeConnection (connectionId: string): Promise<void> {
    const connectionRooms = this.subscriptions.get(connectionId);

    if (! connectionRooms) {
      // No need to raise an error if the connection does not have room subscriptions
      return;
    }

    await Bluebird.map(connectionRooms.roomIds, (roomId: string) => (
      this.unsubscribe(connectionId, roomId).catch(global.kuzzle.log.error)
    ));
  }

  /**
   * Register a new subscription
   *  - save the subscription on the provided room with volatile data
   *  - add the connection to the list of active connections of the room
   */
  private registerSubscription (connectionId: string, roomId: string, volatile: JSONObject): void {
    debug('Add room %s for connection %s', roomId, connectionId);

    let connectionRooms = this.subscriptions.get(connectionId);

    if (! connectionRooms) {
      connectionRooms = new ConnectionRooms();
      this.subscriptions.set(connectionId, connectionRooms);
    }

    connectionRooms.addRoom(roomId, volatile);

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
    const connectionRooms = this.subscriptions.get(connectionId);
    const requestContext = new RequestContext({
      connection: { id: connectionId }
    });

    if (! connectionRooms) {
      throw realtimeError.get('not_subscribed', connectionId, roomId);
    }

    const volatile = connectionRooms.getVolatile(roomId);

    if (volatile === undefined) {
      throw realtimeError.get('not_subscribed', connectionId, roomId);
    }

    if (connectionRooms.count > 1) {
      connectionRooms.removeRoom(roomId);
    }
    else {
      this.subscriptions.delete(connectionId);
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
    // @aschen Why ?
    if ( notify
      && this.rooms.has(roomId)
      && room.channels.size > 0
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

    const channel = new Channel(roomId, { propagate, scope, users });
    const connectionRooms = this.subscriptions.get(connectionId);
    const room = this.rooms.get(roomId);

    if (! connectionRooms || ! connectionRooms.hasRoom(roomId)) {
      subscribed = true;
      this.registerSubscription(connectionId, roomId, request.input.volatile);

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

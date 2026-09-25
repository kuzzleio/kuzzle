/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

import Bluebird from "bluebird";
import Long from "long";
import * as protobuf from "protobufjs";
import { Publisher } from "zeromq";

import type { JSONObject } from "kuzzle-sdk";
import type { NormalizedFilter } from "koncorde";

import type DocumentNotification from "../core/realtime/notification/document";
import type UserNotification from "../core/realtime/notification/user";
import type { storeScopeEnum } from "../core/storage/storeScopeEnum";
import type { IKuzzleConfiguration } from "../types/config/KuzzleConfiguration";

const STATE = Object.freeze({
  READY: 1,
  SENDING: 2,
});

type PublisherState = (typeof STATE)[keyof typeof STATE];

/**
 * What the publisher needs from the node that owns it. `node.js` is converted
 * in J3; this is the part of its surface this file actually reads, not a
 * placeholder for the whole class.
 */
type PublishingNode = {
  config: IKuzzleConfiguration["cluster"];
};

/**
 * A sent message, kept so that a subscriber that missed it can ask for it again
 * instead of evicting itself (#2785).
 */
type SentMessage = BufferedMessage & { messageId: Long };

/**
 * Test-only fault injection: when set to N > 0, every Nth message this node
 * publishes is recorded as sent but never handed to the socket, so that the
 * functional suites exercise the retransmission path. Unset in production.
 */
const DROP_EVERY_ENV = "KUZZLE_TEST_CLUSTER_SYNC_DROP_EVERY";

type BufferedMessage = {
  topic: string;
  /**
   * protobuf's `finish()` returns a `Uint8Array`, not a `Buffer` — the JSDoc on
   * `bufferSend` claimed `Buffer` for as long as the file was JavaScript.
   */
  data: Uint8Array;
};

// Handles messages publication to other nodes
class ClusterPublisher {
  private readonly node: PublishingNode;

  /**
   * ID of the last message sent. Read by `command.js` to answer a handshake,
   * and by every `send*` caller that needs to name the message it just queued.
   */
  public lastMessageId: Long;

  private socket: Publisher | null;

  private protoroot: protobuf.Root | null;

  private state: PublisherState;

  private buffer: BufferedMessage[];

  /**
   * The last messages sent, oldest first, with contiguous ids: what
   * `replay()` answers from. Bounded by `cluster.retransmitBuffer`.
   */
  private readonly history: SentMessage[];

  private historyBytes: number;

  private readonly dropEvery: number;

  /**
   * @param node the cluster node this publisher belongs to
   */
  constructor(node: PublishingNode) {
    this.node = node;
    this.lastMessageId = new Long(0, 0, true);
    this.socket = null;
    this.protoroot = null;

    // Only one call to socket.send can be performed at any given time, and it
    // must be awaited before another send is launched.
    // Since cluster syncs are triggered on events emitted by Kuzzle, and since
    // those events aren't awaitable, many send requests can be requested
    // before a single one has time to finish. We need to handle that here,
    // by bufferizing requests to send
    this.state = STATE.READY;
    this.buffer = [];

    this.history = [];
    this.historyBytes = 0;

    const dropEvery = Number.parseInt(process.env[DROP_EVERY_ENV] ?? "", 10);
    this.dropEvery =
      Number.isInteger(dropEvery) && dropEvery > 0 ? dropEvery : 0;
  }

  async init(): Promise<void> {
    this.socket = new Publisher();
    await this.socket.bind(`tcp://*:${this.node.config.ports.sync}`);

    this.protoroot = await protobuf.load(`${__dirname}/protobuf/sync.proto`);
  }

  /**
   * Publishes an event telling them that this node has created a new room
   *
   * @param normalized - Obtained with Koncorde.normalize()
   * @return ID of the message sent to other nodes
   */
  sendNewRealtimeRoom(normalized: NormalizedFilter): Long {
    const payload = {
      filter: JSON.stringify(normalized.filter),
      id: normalized.id,
      index: normalized.index,
    };

    return this.send("NewRealtimeRoom", payload);
  }

  /**
   * Publishes an event telling telling them that this node
   * no longer has subscribers on the provided realtime room.
   *
   * @param roomId
   * @return ID of the message sent to other nodes
   */
  sendRemoveRealtimeRoom(roomId: string): Long {
    return this.send("RemoveRealtimeRoom", { roomId });
  }

  /**
   * Publishes an event telling that a room has one less subscriber
   * @param roomId
   * @return ID of the message sent to other nodes
   */
  sendUnsubscription(roomId: string): Long {
    return this.send("Unsubscription", { roomId });
  }

  /**
   * Publishes an event telling that a new subscription has been made
   * made to an existing room
   *
   * @param roomId
   * @return Id of the message sent to other nodes
   */
  sendSubscription(roomId: string): Long {
    return this.send("Subscription", { roomId });
  }

  /**
   * Publishes an event telling that a document notification must be
   * propagated
   *
   * @param rooms - Koncorde rooms
   * @param notification
   * @return Id of the message sent to other nodes
   */
  sendDocumentNotification(
    rooms: string[],
    notification: DocumentNotification,
  ): Long {
    return this.send("DocumentNotification", {
      action: notification.action,
      collection: notification.collection,
      controller: notification.controller,
      index: notification.index,
      protocol: notification.protocol,
      requestId: notification.requestId,
      result: JSON.stringify(notification.result),
      rooms,
      scope: notification.scope,
      status: notification.status,
      timestamp: notification.timestamp,
      volatile: JSON.stringify(notification.volatile),
    });
  }

  /**
   * Publishes an event telling that a user notification must be
   * propagated
   *
   * @param room - Koncorde room
   * @param notification
   * @return Id of the message sent to other nodes
   */
  sendUserNotification(room: string, notification: UserNotification): Long {
    return this.send("UserNotification", {
      action: notification.action,
      collection: notification.collection,
      controller: notification.controller,
      index: notification.index,
      protocol: notification.protocol,
      result: JSON.stringify(notification.result),
      room,
      status: notification.status,
      timestamp: notification.timestamp,
      user: notification.user,
      volatile: JSON.stringify(notification.volatile),
    });
  }

  /**
   * Publishes an event telling that a new authentication strategy has been
   * dynamically added
   *
   * @param strategyName
   * @param pluginName
   * @param strategy
   * @return Id of the message sent to other nodes
   */
  sendNewAuthStrategy(
    strategyName: string,
    pluginName: string,
    strategy: JSONObject,
  ): Long {
    return this.send("NewAuthStrategy", {
      pluginName,
      strategy,
      strategyName,
    });
  }

  /**
   * Publishes an event telling that a new authentication strategy has been
   * dynamically added
   *
   * @param strategyName
   * @param pluginName
   * @return Id of the message sent to other nodes
   */
  sendRemoveAuthStrategy(strategyName: string, pluginName: string): Long {
    return this.send("RemoveAuthStrategy", {
      pluginName,
      strategyName,
    });
  }

  /**
   * Publishes an event telling other nodes to create an info dump
   *
   * @param suffix - dump directory suffix name
   * @returns ID of the message sent
   */
  sendDumpRequest(suffix: string): Long {
    return this.send("DumpRequest", { suffix });
  }

  /**
   * Publishes an event about a new index being added
   *
   * @param scope
   * @param index
   * @returns ID of the message sent
   */
  sendAddIndex(scope: storeScopeEnum, index: string): Long {
    return this.send("AddIndex", { index, scope });
  }

  /**
   * Publishes an event about a new collection being added
   *
   * @param scope
   * @param index
   * @param collection
   * @returns ID of the message sent
   */
  sendAddCollection(
    scope: storeScopeEnum,
    index: string,
    collection: string,
  ): Long {
    return this.send("AddCollection", { collection, index, scope });
  }

  /**
   * Publishes an event about indexes been removed
   *
   * @param scope
   * @param indexes
   * @returns ID of the message sent
   */
  sendRemoveIndexes(scope: storeScopeEnum, indexes: string[]): Long {
    return this.send("RemoveIndexes", { indexes, scope });
  }

  /**
   * Publishes an event about a collection been removed
   *
   * @param scope
   * @param index
   * @param collection
   * @returns ID of the message sent
   */
  sendRemoveCollection(
    scope: storeScopeEnum,
    index: string,
    collection: string,
  ): Long {
    return this.send("RemoveCollection", { collection, index, scope });
  }

  /**
   * Publishes an event about a cluster-wide event emission
   *
   * @param event name
   * @param payload - event payload
   * @returns ID of the message sent
   */
  sendClusterWideEvent(event: string, payload: JSONObject): Long {
    return this.send("ClusterWideEvent", {
      event,
      payload: JSON.stringify(payload),
    });
  }

  /**
   * Publishes an event about shutdown
   *
   * @param nodeId - node ID
   *
   * @returns ID of the message sent
   */
  sendNodeShutdown(nodeId: string): Long {
    return this.send("NodeShutdown", { nodeId });
  }

  /**
   * Publishes an event about the node being in debug mode
   * @param evictionPrevented
   *
   * @returns ID of the message sent
   */
  sendNodePreventEviction(evictionPrevented: boolean): Long {
    return this.send("NodePreventEviction", { evictionPrevented });
  }

  /**
   * Publishes an event about a node being evicted
   *
   * @param evictor node ID of the evictor
   * @param nodeId - node ID of the node being evicted
   * @param reason - reason of the eviction
   *
   * @returns ID of the message sent
   */
  sendNodeEvicted(evictor: string, nodeId: string, reason: string): Long {
    return this.send("NodeEvicted", { evictor, nodeId, reason });
  }

  /**
   * Publishes an event about heartbeat
   *
   * @param address node sync address
   *
   * @returns ID of the message sent
   */
  sendHeartbeat(address: string): Long {
    return this.send("Heartbeat", { address });
  }

  /**
   * Broadcasts a sync message. Topic must match a protobuf type name.
   * Returns immediately, but the message to be sent migh be bufferized and send
   * later.
   *
   * @param topic name
   * @param data
   * @returns ID of the message sent
   * @throws If the topic's protobuf type cannot be found
   */
  send(topic: string, data: JSONObject): Long {
    // `socket` and `protoroot` are both filled by `init()` and nulled by
    // `dispose()`, together: one guard answers for both, where the old one
    // answered for the socket and left `protoroot` to be taken on trust.
    if (this.socket === null || this.protoroot === null) {
      return Long.NEG_ONE;
    }

    this.lastMessageId = this.lastMessageId.add(1);

    const payload = { messageId: this.lastMessageId, ...data };
    const type = this.protoroot.lookupType(topic);
    const buffer = type.encode(type.create(payload)).finish();

    this.remember(this.lastMessageId, topic, buffer);

    if (
      this.dropEvery > 0 &&
      this.lastMessageId.modulo(this.dropEvery).isZero()
    ) {
      return this.lastMessageId;
    }

    // DO NOT AWAIT: bufferSend is built to bufferize payloads to be sent, and
    // it makes sure that they are sent in order and serially (0mq publisher
    // sockets can only send 1 message at a time, otherwise it throws with a
    // EAGAIN error)
    // Awaiting this method has no practical use. If you DO want to await it
    // (don't), then you have to first make a local copy of this.lastMessageId
    // to make sure that the value returned to the caller has not been
    // increased by other calls
    this.bufferSend(topic, buffer);

    return this.lastMessageId;
  }

  /**
   * The messages sent with ids `from` to `to`, both included, in order — or
   * `null` if any of them is no longer kept (or never was).
   */
  replay(from: Long, to: Long): BufferedMessage[] | null {
    const oldest = this.history[0];
    const newest = this.history.at(-1);

    if (
      oldest === undefined ||
      newest === undefined ||
      from.greaterThan(to) ||
      from.lessThan(oldest.messageId) ||
      to.greaterThan(newest.messageId)
    ) {
      return null;
    }

    // Ids are contiguous, so offsets are plain differences; both are bounded
    // by the history's length, far below 2^53.
    const start = from.subtract(oldest.messageId).toNumber();
    const end = to.subtract(oldest.messageId).toNumber();

    return this.history
      .slice(start, end + 1)
      .map(({ data, topic }) => ({ data, topic }));
  }

  /**
   * Keeps a sent message for `replay()`, then trims the oldest ones until
   * both of `cluster.retransmitBuffer`'s bounds hold. A bound of 0 keeps
   * nothing: retransmission is disabled.
   */
  private remember(messageId: Long, topic: string, data: Uint8Array): void {
    const { bytes, messages } = this.node.config.retransmitBuffer;

    if (messages <= 0 || bytes <= 0) {
      return;
    }

    this.history.push({ data, messageId, topic });
    this.historyBytes += data.byteLength;

    while (
      this.history.length > messages ||
      (this.historyBytes > bytes && this.history.length > 0)
    ) {
      const dropped = this.history.shift();

      this.historyBytes -= dropped?.data.byteLength ?? 0;
    }
  }

  /**
   * Sends the provided message, and then sends all pending ones waiting in
   * the buffer, in order
   *
   * @param topic
   * @param data
   */
  async bufferSend(topic: string, data: Uint8Array): Promise<void> {
    this.buffer.push({ data, topic });

    if (this.state === STATE.SENDING) {
      return;
    }

    this.state = STATE.SENDING;

    do {
      const _buffer = this.buffer;
      this.buffer = [];

      // `_buffer` is a local snapshot — `this.buffer` is reassigned to a new
      // array above, never mutated in place — so iterating it directly is the
      // same traversal as the index loop this replaces, without the
      // `noUncheckedIndexedAccess` noise.
      for (const payload of _buffer) {
        // `dispose()` can null the socket while this loop awaits. Before, that
        // surfaced as a TypeError on the next iteration; there is nothing left
        // to flush once the socket is gone.
        if (this.socket === null) {
          this.buffer = [];
          this.state = STATE.READY;

          return;
        }

        // This method will never return a rejected promise
        // http://zeromq.github.io/zeromq.js/classes/publisher.html#send
        await this.socket.send([payload.topic, payload.data]);
      }
    } while (this.buffer.length > 0);

    this.state = STATE.READY;
  }

  async dispose(): Promise<void> {
    // waits for the buffer to be empty before closing
    while (this.state !== STATE.READY) {
      await Bluebird.delay(100);
    }

    if (this.socket !== null) {
      this.socket.close();
      this.socket = null;
    }
  }
}

export = ClusterPublisher;

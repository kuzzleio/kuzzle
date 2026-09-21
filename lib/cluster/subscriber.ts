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

import { inspect } from "node:util";

import Long from "long";
import * as protobuf from "protobufjs";
import { Subscriber } from "zeromq";

import DocumentNotification from "../core/realtime/notification/document";
import UserNotification from "../core/realtime/notification/user";
import createDebug from "../util/debug";
import { fromKoncordeIndex } from "../util/koncordeCompat";

import type { RealtimeScope, RealtimeUsers } from "../types";
import type { IKuzzleConfiguration } from "../types/config/KuzzleConfiguration";
import type State from "./state";
import type {
  AddCollectionMessage,
  AddIndexMessage,
  ClusterWideEventMessage,
  DocumentNotificationMessage,
  DumpRequestMessage,
  InvalidateProfileMessage,
  InvalidateRoleMessage,
  NewAuthStrategyMessage,
  NewRealtimeRoomMessage,
  NodeEvictedMessage,
  NodePreventEvictionMessage,
  NodeShutdownMessage,
  RemoveAuthStrategyMessage,
  RemoveCollectionMessage,
  RemoveIndexesMessage,
  RemoveRealtimeRoomMessage,
  SubscriptionMessage,
  SyncMessage,
  SyncMessages,
  SyncTopic,
  UnsubscriptionMessage,
  UserNotificationMessage,
} from "./protobuf/syncMessages";

const debug = createDebug("kuzzle:cluster:sync");

/**
 * `sync.proto` types `scope` and `user` as plain strings, while the
 * notifications built from them take closed unions — and nothing between the
 * wire and the notification checked that the string was a member. See TD-68
 * (#2779); keep these lists in step with the unions they `satisfies`.
 */
const REALTIME_SCOPES: readonly string[] = [
  "all",
  "in",
  "out",
] satisfies readonly RealtimeScope[];
const REALTIME_USERS: readonly string[] = [
  "all",
  "in",
  "none",
  "out",
] satisfies readonly RealtimeUsers[];

/**
 * A topic is a protobuf type name, and the handler table below covers exactly
 * `sync.proto`'s message list — but `lookup()` also resolves nested types, so a
 * decodable topic is not automatically one this node knows how to apply.
 */
function isSyncTopic(
  handlers: Readonly<SyncMessageHandlers>,
  topic: string,
): topic is SyncTopic {
  return Object.hasOwn(handlers, topic);
}

function isRealtimeScope(value: string): value is RealtimeScope {
  return REALTIME_SCOPES.includes(value);
}

function isRealtimeUsers(value: string): value is RealtimeUsers {
  return REALTIME_USERS.includes(value);
}

/* eslint-disable sort-keys */
const stateEnum = Object.freeze({
  BUFFERING: 1,
  SANE: 2,
  MISSING_HEARTBEAT: 3,
  EVICTED: 4,
});
/* eslint-enable sort-keys */

/**
 * A frame as `protobufjs` hands it back, before `validateMessage()` has
 * established that it carries the `messageId` every sync message must have.
 */
type DecodedMessage = Partial<SyncMessage> & Record<string, unknown>;

/**
 * What a subscriber needs from the node that owns it. `node.js` is converted in
 * J3; this is the part of its surface this file actually reads.
 */
type SubscribingNode = {
  config: IKuzzleConfiguration["cluster"];
  heartbeatDelay: number;
  nodeId: string;
  fullState: State;
  eventEmitter: { emit(event: string, payload: unknown): void };
  evictNode(
    nodeId: string,
    options: { broadcast: boolean; reason: string },
  ): Promise<void>;
  evictSelf(reason: string, error?: Error): Promise<void>;
};

/**
 * A topic's handler, as the dispatch table holds it: each one is declared with
 * the message type `sync.proto` gives its topic, so registering a handler under
 * the wrong topic stops compiling.
 */
type SyncMessageHandlers = {
  [T in SyncTopic]: (message: SyncMessages[T]) => void | Promise<void>;
};

/** One raw frame as it comes off the socket, before it is decoded. */
type BufferedFrame = [topic: string, data: Buffer];

// Handles messages received from other nodes
class ClusterSubscriber {
  static readonly stateEnum = stateEnum;

  private readonly localNode: SubscribingNode;

  public readonly remoteNodeIP: string;

  private readonly remoteNodeAddress: string;

  public readonly remoteNodeId: string;

  /** Used in debug mode when the node might be slower */
  public remoteNodeEvictionPrevented: boolean;

  private socket: Subscriber | null;

  private protoroot: protobuf.Root | null;

  /** keeps track of received message ids from the remote node */
  public lastMessageId: Long;

  public subscriptionConfirmed: boolean;

  private readonly subscriptionProof: Promise<void>;

  private confirmSubscription: () => void;

  /**
   * One of the values of `stateEnum`. Deliberately `number` and not the
   * literal union `1 | 2 | 3 | 4`: `state` is mutated by other methods while
   * `listen()` is awaiting a socket read, and TypeScript's control-flow
   * narrowing does not model that — under the literal union it reports the
   * deliberate re-checks after an `await` as impossible comparisons. Those
   * re-checks are the point.
   */
  public state: number;

  private buffer: BufferedFrame[];

  private heartbeatTimer: NodeJS.Timeout | null;

  public lastHeartbeat: number;

  private readonly heartbeatDelay: number;

  public readonly handlers: Readonly<SyncMessageHandlers>;

  private readonly logger: ReturnType<typeof global.kuzzle.log.child>;

  /**
   * @param localNode the cluster node this subscriber belongs to
   * @param remoteNodeId - Remote node unique ID
   * @param remoteNodeIP - address of the distant node
   */
  constructor(
    localNode: SubscribingNode,
    remoteNodeId: string,
    remoteNodeIP: string,
  ) {
    // not to be confused with remote nodes
    this.localNode = localNode;

    this.remoteNodeIP = remoteNodeIP;
    this.remoteNodeAddress = `tcp://${remoteNodeIP}:${this.localNode.config.ports.sync}`;
    this.remoteNodeId = remoteNodeId;
    // Used in debug mode when the node might be slower
    this.remoteNodeEvictionPrevented = false;
    this.socket = null;
    this.protoroot = null;

    // keeps track of received message ids from the remote node
    this.lastMessageId = new Long(0, 0, true);

    // Receiving anything at all from the remote node is the only observable
    // proof that this subscription has taken effect on its PUB socket: ZeroMQ
    // propagates a subscription as a message sent TO the publisher, which does
    // the filtering, and until it lands the publisher silently drops what it
    // sends. See waitForSubscription() and TD-65 (#2773).
    this.subscriptionConfirmed = false;
    // The executor runs synchronously, so the no-op is replaced before anything
    // can call it — it is there to state that this field is never unassigned.
    this.confirmSubscription = () => {};
    this.subscriptionProof = new Promise<void>((resolve) => {
      this.confirmSubscription = resolve;
    });

    // A subscriber starts in the BUFFERING state, meaning it stores incoming
    // sync messages without processing them, until it enters the SANE state
    // This delays applying sync messages while the local node initializes
    this.state = stateEnum.BUFFERING;
    this.buffer = [];

    // keeps track of the remote node heartbeats, and evicts it if no
    // heartbeats have been received after some time
    this.heartbeatTimer = null;
    this.lastHeartbeat = Date.now();
    this.heartbeatDelay = this.localNode.heartbeatDelay * 1.5;

    // Messages handlers (quick translation between a topic name and its
    // associated handler)
    this.handlers = Object.freeze({
      AddCollection: this.handleCollectionAddition,
      AddIndex: this.handleIndexAddition,
      ClusterWideEvent: this.handleClusterWideEvent,
      DocumentNotification: this.handleDocumentNotification,
      DumpRequest: this.handleDumpRequest,
      Heartbeat: this.handleHeartbeat,
      InvalidateProfile: this.handleProfileInvalidation,
      InvalidateRole: this.handleRoleInvalidation,
      NewAuthStrategy: this.handleNewAuthStrategy,
      NewRealtimeRoom: this.handleNewRealtimeRoom,
      NodeEvicted: this.handleNodeEviction,
      NodePreventEviction: this.handleNodePreventEviction,
      NodeShutdown: this.handleNodeShutdown,
      RefreshIndexCache: this.handleRefreshIndexCache,
      RefreshValidators: this.handleRefreshValidators,
      RemoveAuthStrategy: this.handleAuthStrategyRemoval,
      RemoveCollection: this.handleCollectionRemoval,
      RemoveIndexes: this.handleIndexesRemoval,
      RemoveRealtimeRoom: this.handleRealtimeRoomRemoval,
      ResetSecurity: this.handleResetSecurity,
      Shutdown: this.handleShutdown,
      Subscription: this.handleSubscription,
      Unsubscription: this.handleUnsubscription,
      UserNotification: this.handleUserNotification,
    });

    this.logger = global.kuzzle.log.child("cluster:subscriber");
  }

  /**
   * Initializes this class, establishes a connection to the remote node and
   * starts listening to it.
   */
  async init(): Promise<void> {
    this.protoroot = await protobuf.load(`${__dirname}/protobuf/sync.proto`);
    this.socket = new Subscriber();
    this.socket.connect(this.remoteNodeAddress);
    this.socket.subscribe();
    this.heartbeatTimer = setInterval(
      () => this.checkHeartbeat(),
      this.heartbeatDelay,
    );

    this.listen();
  }

  /**
   * Starts subscribing to other nodes
   * Do NOT wait this method: it's an infinite loop, it's not meant to ever
   * return (unless the remote node has been evicted)
   */
  async listen(): Promise<void> {
    while (this.state !== stateEnum.EVICTED) {
      let frame: Buffer[];

      try {
        // `dispose()` drops the socket, and the loop's own condition is
        // checked before the state it sets is visible here.
        if (this.socket === null) {
          return;
        }

        frame = await this.socket.receive();
      } catch (e) {
        if (this.state !== stateEnum.EVICTED) {
          await this.evictNode({
            broadcast: true,
            reason: e instanceof Error ? e.message : inspect(e),
          });
        }

        return;
      }

      const [topic, data] = frame;

      // A sync message is a topic and a payload. One that is neither is not
      // something to dispatch on, and both frames were read unchecked.
      if (topic === undefined || data === undefined) {
        continue;
      }

      if (!this.subscriptionConfirmed) {
        this.subscriptionConfirmed = true;
        this.confirmSubscription();
      }

      // do nothing is the node was evicted even if we already check
      // for this in processData()
      if (this.state === stateEnum.EVICTED) {
        return;
      }

      if (this.state !== stateEnum.BUFFERING) {
        await this.processData(topic.toString(), data);
      } else {
        this.buffer.push([topic.toString(), data]);
      }
    }
  }

  /**
   * Resolves once a message has been received from the remote node, which is
   * the only observable proof that this subscription is live on its side.
   *
   * The handshake reads a remote node's `lastMessageId` over the *command*
   * channel and then resumes this subscription from it. Nothing orders that
   * snapshot after the subscription taking effect on the *sync* channel — they
   * are different sockets — so without this wait, anything the remote publishes
   * in between is dropped by its PUB socket while this node is told to resume
   * from just before it. That gap is read as a desync. See TD-65 (#2773).
   *
   * Every node publishes a heartbeat every `cluster.heartbeat` ms (2s by
   * default) from before it is discoverable, so this normally costs less than
   * one round.
   *
   * @param timeout - ms to wait before giving up
   * @return whether the subscription was proven live
   */
  async waitForSubscription(timeout: number): Promise<boolean> {
    if (this.subscriptionConfirmed) {
      return true;
    }

    let timer: NodeJS.Timeout | undefined;
    const expired = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), timeout);
    });

    const confirmed = await Promise.race([
      this.subscriptionProof.then(() => true),
      expired,
    ]);

    clearTimeout(timer);

    return confirmed;
  }

  /**
   * Plays all buffered sync messages, and switches this subscriber state from
   * BUFFERING to SANE.
   *
   * @param lastMessageId
   * @return false if a gap was found while replaying, which evicts this node
   */
  async sync(lastMessageId: Long): Promise<boolean> {
    this.lastMessageId = lastMessageId;

    // copy the buffer for processing: new sync messages might be buffered
    // while we apply older messages with async functions
    while (this.buffer.length > 0) {
      const _buffer = this.buffer;
      this.buffer = [];

      for (const [topic, data] of _buffer) {
        await this.processData(topic, data);

        // A gap found during the replay evicts this node. Without this check
        // the loop would go on applying messages and then overwrite EVICTED
        // with SANE on the way out.
        if (this.state === stateEnum.EVICTED) {
          return false;
        }
      }
    }

    this.state = stateEnum.SANE;

    return true;
  }

  /**
   * Decodes an incoming message, and dispatches it.
   * The topic name must match a protobuf message.
   *
   * /!\ This method MUST NEVER THROW
   * It's awaited by this.listen(), which cannot be awaited (infinite loop),
   * and it also cannot afford to attach a rejection handler everytime a message
   * is received to prevent clogging the event loop with unnecessary promises
   *
   * @param topic
   * @param data
   */
  async processData(topic: string, data: Buffer): Promise<void> {
    if (this.state === stateEnum.EVICTED) {
      return;
    }

    const decoder = this.protoroot?.lookup(topic) ?? null;

    // `lookup` resolves any reflection object, not only message types, so a
    // topic naming — say — a nested namespace used to reach `decoder.decode`
    // with that method undefined: a TypeError thrown out of a method documented
    // as never throwing, into `listen()`'s un-awaitable loop. The compiler asked
    // for the narrowing; treating it as the unknown-topic case below is what the
    // `null` branch already meant.
    if (
      decoder === null ||
      !(decoder instanceof protobuf.Type) ||
      !isSyncTopic(this.handlers, topic)
    ) {
      await this.evictNode({
        broadcast: true,
        reason: `received an invalid message from ${this.remoteNodeId} (unknown topic "${topic}")`,
      });
      return;
    }

    const message: DecodedMessage = decoder.toObject(decoder.decode(data));

    if (!(await this.validateMessage(message))) {
      return;
    }

    try {
      // If we are receiving messages from a node,
      // it means the node is alive so it should counts as an heartbeat
      this.handleHeartbeat();
      // `Reflect.apply`, not `handlers[topic].call`: the handler table is a
      // union of per-topic signatures, and `call` asks each of them to accept
      // `this` plus every other member's message. `isSyncTopic` above is what
      // pairs the topic with its message.
      await Reflect.apply(this.handlers[topic], this, [message]);
    } catch (e) {
      this.localNode.evictSelf(
        `Unable to process sync message (topic: ${topic}, message: ${JSON.stringify(
          message,
        )}`,
        e instanceof Error ? e : new Error(inspect(e)),
      );
    }
  }

  /**
   * Set from two places: a `NodePreventEviction` message published by this
   * peer, and `node.preventEviction()` on this node. The local caller used to
   * reach the wire handler below with a hand-built `{ evictionPrevented }` —
   * an object shaped like a sync message that never came off the wire and
   * carries no `messageId`. The conversion could not type that, and it should
   * not have to: the two callers want the same effect, not the same envelope.
   */
  setEvictionPrevented(evictionPrevented: boolean): void {
    this.remoteNodeEvictionPrevented = evictionPrevented;
  }

  async handleNodePreventEviction(
    message: NodePreventEvictionMessage,
  ): Promise<void> {
    this.setEvictionPrevented(message.evictionPrevented);
  }

  /**
   * Handles a heartbeat from the remote node
   *
   */
  handleHeartbeat(): void {
    this.lastHeartbeat = Date.now();
  }

  /**
   * Handles a node eviction message.
   *
   * @param message - decoded NodeEvicted protobuf message
   */
  async handleNodeEviction(message: NodeEvictedMessage): Promise<void> {
    if (message.nodeId === this.localNode.nodeId) {
      this.logger.error(
        `[CLUSTER] Node evicted by ${message.evictor}. Reason: ${message.reason}`,
      );
      global.kuzzle.shutdown();
      return;
    }

    await this.localNode.evictNode(message.nodeId, {
      broadcast: false,
      reason: message.reason,
    });
  }

  /**
   * Handles a node shutdown.
   *
   * @param message - decoded NodeShutdown protobuf message
   */
  async handleNodeShutdown(message: NodeShutdownMessage): Promise<void> {
    await this.localNode.evictNode(message.nodeId, {
      broadcast: false,
      reason: "Node is shutting down",
    });
  }

  /**
   * Handles messages about realtime room creations
   *
   * @param message - decoded NewRealtimeRoom protobuf message
   */
  handleNewRealtimeRoom(message: NewRealtimeRoomMessage): void {
    const { id, index, filter, messageId } = message;
    const icpair = fromKoncordeIndex(index);

    debug(
      "New realtime room created by node %s (message: %d, room: %s, index: %s, collection: %s)",
      this.remoteNodeId,
      messageId,
      id,
      icpair.index,
      icpair.collection,
    );

    this.localNode.fullState.addRealtimeRoom(
      id,
      icpair.index,
      icpair.collection,
      JSON.parse(filter),
      {
        messageId,
        nodeId: this.remoteNodeId,
        subscribers: 0,
      },
    );
  }

  /**
   * Handles messages about realtime subscriptions
   *
   * @param message - decoded Subscription protobuf message
   */
  handleSubscription(message: SubscriptionMessage): void {
    debug(
      "New realtime subscription received from node %s (message: %d, room: %s)",
      this.remoteNodeId,
      message.messageId,
      message.roomId,
    );

    this.localNode.fullState.addRealtimeSubscription(
      message.roomId,
      this.remoteNodeId,
      message.messageId,
    );
  }

  /**
   * Handles messages about realtime room removal
   *
   * @param message - decoded RemoveRealtimeRoom protobuf message
   */
  handleRealtimeRoomRemoval(message: RemoveRealtimeRoomMessage): void {
    debug(
      "Realtime room removal received from node %s (message: %d, room: %s)",
      this.remoteNodeId,
      message.messageId,
      message.roomId,
    );

    this.localNode.fullState.removeRealtimeRoom(
      message.roomId,
      this.remoteNodeId,
    );
  }

  /**
   * Handles messages about user unsubscriptions
   *
   * @param message - decoded Unsubscription protobuf message
   */
  handleUnsubscription(message: UnsubscriptionMessage): void {
    debug(
      "Realtime unsubscription received from node %s (message: %d, room: %s)",
      this.remoteNodeId,
      message.messageId,
      message.roomId,
    );

    this.localNode.fullState.removeRealtimeSubscription(
      message.roomId,
      this.remoteNodeId,
      message.messageId,
    );
  }

  /**
   * Handles messages about cluster-wide events
   *
   * @param message - decoded ClusterWideEvent protobuf message
   */
  handleClusterWideEvent(message: ClusterWideEventMessage): void {
    const payload = JSON.parse(message.payload);

    this.localNode.eventEmitter.emit(message.event, payload);
  }

  /**
   * Handles messages about document notifications
   *
   * @param message - decoded DocumentNotification protobuf message
   */
  async handleDocumentNotification(
    message: DocumentNotificationMessage,
  ): Promise<void> {
    // The wire says `string`, `DocumentNotification` says "in" | "out" | "all",
    // and until this conversion nothing checked. Treated as the malformed
    // message it is — the same answer this file already gives to an unknown
    // topic or a missing `messageId`. TD-68 (#2779).
    if (!isRealtimeScope(message.scope)) {
      await this.evictNode({
        broadcast: true,
        reason: `received an invalid message from ${this.remoteNodeId} (unknown document notification scope "${message.scope}")`,
      });
      return;
    }

    const notification = new DocumentNotification({
      action: message.action,
      collection: message.collection,
      controller: message.controller,
      index: message.index,
      node: this.remoteNodeId,
      protocol: message.protocol,
      requestId: message.requestId,
      result: JSON.parse(message.result),
      scope: message.scope,
      status: message.status,
      timestamp: message.timestamp.toNumber(),
      volatile: JSON.parse(message.volatile),
    });

    return global.kuzzle.ask(
      "core:realtime:document:dispatch",
      message.rooms,
      notification,
    );
  }

  /**
   * Handles messages about user notifications
   *
   * @param message - decoded UserNotification protobuf message
   */
  async handleUserNotification(
    message: UserNotificationMessage,
  ): Promise<void> {
    // Same as handleDocumentNotification above: "in" | "out" | "all" | "none"
    // on this side, an unchecked string on the wire. TD-68 (#2779).
    if (!isRealtimeUsers(message.user)) {
      await this.evictNode({
        broadcast: true,
        reason: `received an invalid message from ${this.remoteNodeId} (unknown user notification scope "${message.user}")`,
      });
      return;
    }

    const notification = new UserNotification({
      action: message.action,
      collection: message.collection,
      controller: message.controller,
      index: message.index,
      node: this.remoteNodeId,
      protocol: message.protocol,
      result: JSON.parse(message.result),
      status: message.status,
      timestamp: message.timestamp.toNumber(),
      user: message.user,
      volatile: JSON.parse(message.volatile),
    });

    return global.kuzzle.ask(
      "core:realtime:user:sendMessage",
      message.room,
      notification,
    );
  }

  /**
   * Handles messages about new authentication strategies
   *
   * @param message - decoded NewAuthStrategy protobuf message
   */
  handleNewAuthStrategy(message: NewAuthStrategyMessage): void {
    const { pluginName, strategy, strategyName } = message;

    debug(
      "New authentication strategy added by node %s (plugin: %s, strategy: %s)",
      this.remoteNodeId,
      pluginName,
      strategyName,
    );

    this.localNode.fullState.addAuthStrategy(message);

    global.kuzzle.pluginsManager.registerStrategy(
      pluginName,
      strategyName,
      strategy,
    );
  }

  /**
   * Handles messages about authentication strategy removals
   *
   * @param message - decoded RemoveAuthStrategy protobuf message
   */
  handleAuthStrategyRemoval(message: RemoveAuthStrategyMessage): void {
    const { pluginName, strategyName } = message;

    debug(
      "Authentication strategy removed by node %s (plugin: %s, strategy: %s)",
      this.remoteNodeId,
      pluginName,
      strategyName,
    );

    global.kuzzle.pluginsManager.unregisterStrategy(pluginName, strategyName);
    this.localNode.fullState.removeAuthStrategy(strategyName);
  }

  /**
   * Handles messages about security resets
   *
   */
  async handleResetSecurity(): Promise<void> {
    debug("Security reset received from node %s", this.remoteNodeId);
    await global.kuzzle.ask("core:security:profile:invalidate");
    await global.kuzzle.ask("core:security:role:invalidate");
  }

  /**
   * Handles a cross-nodes dump request
   *
   * @param message - decoded DumpRequest protobuf message
   */
  handleDumpRequest(message: DumpRequestMessage): void {
    debug("Dump generation request received from node %s", this.remoteNodeId);
    global.kuzzle.dump(message.suffix);
  }

  /**
   * Handles cluster-wide shutdown
   */
  handleShutdown(): void {
    debug(
      "Cluster-wide shutdown request received from node %s",
      this.remoteNodeId,
    );
    this.logger.error(
      `[CLUSTER] Cluster wide shutdown from ${this.remoteNodeId}`,
    );
    global.kuzzle.shutdown();
  }

  /**
   * Handles changes on document validators
   *
   */
  async handleRefreshValidators(): Promise<void> {
    debug(
      "Validators changed notification received from node %s",
      this.remoteNodeId,
    );
    await global.kuzzle.validation.curateSpecification();
  }

  /**
   * Handles manual refresh of the index cache
   */
  async handleRefreshIndexCache(): Promise<void> {
    debug(
      "Index cache manually refresh received from node %s",
      this.remoteNodeId,
    );
    await global.kuzzle.ask("core:storage:public:cache:refresh", {
      from: "cluster",
    });
  }

  /**
   * Invalidates a profile to force reloading it from the storage space
   *
   * @param message - decoded InvalidateProfile protobuf message
   */
  async handleProfileInvalidation(
    message: InvalidateProfileMessage,
  ): Promise<void> {
    debug(
      "Profile invalidation request received from node %s (profile: %s)",
      this.remoteNodeId,
      message.profileId,
    );

    await global.kuzzle.ask(
      "core:security:profile:invalidate",
      message.profileId,
    );
  }

  /**
   * Invalidates a role to force reloading it from the storage space
   *
   * @param message - decoded InvalidateRole protobuf message
   */
  async handleRoleInvalidation(message: InvalidateRoleMessage): Promise<void> {
    debug(
      "Role invalidation request received from node %s (role: %s)",
      this.remoteNodeId,
      message.roleId,
    );

    await global.kuzzle.ask("core:security:role:invalidate", message.roleId);
  }

  /**
   * Adds a new index to the index cache
   *
   * @param message - decoded AddIndex protobuf message
   */
  async handleIndexAddition(message: AddIndexMessage): Promise<void> {
    const { index, scope } = message;

    debug(
      "New index added by node %s (scope: %s, index: %s)",
      this.remoteNodeId,
      scope,
      index,
    );

    await global.kuzzle.ask(`core:storage:${scope}:cache:addIndex`, index);
  }

  /**
   * Removes indexes from the index cache
   *
   * @param message - decoded RemoveIndexes protobuf message
   */
  async handleIndexesRemoval(message: RemoveIndexesMessage): Promise<void> {
    const { indexes, scope } = message;

    debug(
      "Indexes removed by node %s (scope: %s, indexes: %s)",
      this.remoteNodeId,
      scope,
      indexes,
    );

    await global.kuzzle.ask(
      `core:storage:${scope}:cache:removeIndexes`,
      indexes,
    );
  }

  /**
   * Adds a new collection to the index cache
   *
   * @param message - decoded AddCollection protobuf message
   */
  async handleCollectionAddition(message: AddCollectionMessage): Promise<void> {
    const { collection, index, scope } = message;

    debug(
      "New collection added by node %s (scope: %s, index: %s, collection: %s)",
      this.remoteNodeId,
      scope,
      index,
      collection,
    );

    await global.kuzzle.ask(
      `core:storage:${scope}:cache:addCollection`,
      index,
      collection,
    );
  }

  /**
   * Removes a collection from the index cache
   *
   * @param message - decoded RemoveCollection protobuf message
   */
  async handleCollectionRemoval(
    message: RemoveCollectionMessage,
  ): Promise<void> {
    const { collection, index, scope } = message;

    debug(
      "Indexes removed by node %s (scope: %s, index: %s, collection: %s)",
      this.remoteNodeId,
      scope,
      index,
      collection,
    );

    await global.kuzzle.ask(
      `core:storage:${scope}:cache:removeCollection`,
      index,
      collection,
    );
  }

  /**
   * Checks that we did receive a heartbeat from the remote node
   * If a heartbeat is missing, we allow 1 heartbeat round for the remote node
   * to recover, otherwise we evict it from the cluster.
   */
  async checkHeartbeat(): Promise<void> {
    if (this.remoteNodeEvictionPrevented) {
      // Fake the heartbeat while the node eviction prevention is enabled
      // otherwise when the node eviction prevention is disabled
      // the node will be evicted if it did not send a heartbeat before disabling the protection.
      this.lastHeartbeat = Date.now();
      return;
    }

    if (this.state === stateEnum.EVICTED) {
      return;
    }

    const now = Date.now();

    if (now - this.lastHeartbeat > this.heartbeatDelay) {
      if (this.state === stateEnum.MISSING_HEARTBEAT) {
        await this.evictNode({
          broadcast: true,
          reason: "heartbeat timeout",
        });
      } else {
        this.state = stateEnum.MISSING_HEARTBEAT;
      }
    } else {
      this.state = stateEnum.SANE;
    }
  }

  /**
   * Disconnects from the remote node, and frees all allocated resources.
   */
  dispose(): void {
    if (this.state === stateEnum.EVICTED) {
      return;
    }

    this.state = stateEnum.EVICTED;
    this.socket?.close();
    this.socket = null;
    clearInterval(this.heartbeatTimer ?? undefined);
  }

  /**
   * Checks that the received message is the one we expect.
   * @param message - decoded protobuf message
   * @return false: the message must be discarded, true otherwise
   */
  async validateMessage(message: DecodedMessage): Promise<boolean> {
    const messageId = message.messageId;

    // Read once and checked for what it is: `has()` answers whether the key
    // is there, which is not what the three `Long` operations below need.
    if (messageId === undefined) {
      this.logger.warn(
        `Invalid message received from node ${this.remoteNodeId}. Evicting it.`,
      );

      await this.evictNode({
        broadcast: true,
        reason: 'invalid message received (missing "messageId" field)',
      });

      return false;
    }

    if (
      this.state === stateEnum.BUFFERING &&
      this.lastMessageId.greaterThanOrEqual(messageId)
    ) {
      return false;
    }

    this.lastMessageId = this.lastMessageId.add(1);

    if (this.lastMessageId.notEquals(messageId)) {
      // `lastMessageId` was advanced to the id this node EXPECTS on the line
      // above, so the number of missing messages is the plain difference. The
      // `- 1` this used to carry computed the gap against the previous id, so a
      // single-message loss — by far the most frequent — reported "0 messages
      // lost", which reads as a spurious eviction and got this detector
      // dismissed through five reviews of TD-33 (#2715). See TD-58 (#2762).
      //
      // Long arithmetic rather than `-`: message ids are 64-bit and
      // `message.messageId` may arrive as a Long or as a number depending on
      // how the protobuf reader was configured, so subtracting with `-` leans
      // on `Long.prototype.valueOf` — which works, loses precision past 2^53,
      // and is what SonarCloud's S3757 objects to. `fromValue` accepts either
      // shape and `subtract` is exact.
      const lost = Long.fromValue(messageId).subtract(this.lastMessageId);

      // Stop before evicting, for two reasons. `lastMessageId` is advanced by
      // exactly one per message and is not resynchronised here, so leaving this
      // subscriber running would re-trip this same check on every subsequent
      // message: one drop was reported nine times in five seconds in CI, and
      // occurrence counts read off those lines overcount. It also ends
      // `listen()`'s loop, which is what "this node is out of the cluster"
      // should mean locally. See TD-67 (#2776).
      this.state = stateEnum.EVICTED;

      await this.localNode.evictSelf(
        `Node out-of-sync: ${lost.toString()} messages lost from node ${
          this.remoteNodeId
        }`,
      );
      return false;
    }

    return true;
  }

  async evictNode({
    broadcast,
    reason,
  }: {
    broadcast: boolean;
    reason: string;
  }): Promise<void> {
    this.state = stateEnum.EVICTED;

    await this.localNode.evictNode(this.remoteNodeId, { broadcast, reason });
  }
}

export = ClusterSubscriber;

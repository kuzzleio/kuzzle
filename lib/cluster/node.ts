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

// Bare specifiers, not the `node:` prefix: `node.test.js` intercepts `os` with
// `mock-require` to feed `getIP()` a fixed set of network interfaces, and a
// `node:os` import compiles to `require("node:os")`, which that interception
// does not see. A conversion must not change how a module is resolved — see
// J3a, where a hard-coded `.js` next to a renamed file took the whole
// functional matrix down.
import assert from "assert"; // NOSONAR
import net from "net"; // NOSONAR
import os from "os"; // NOSONAR

import Bluebird from "bluebird";
import EventEmitter from "eventemitter3";
import type { NormalizedFilter } from "koncorde";
import type DocumentNotification from "../core/realtime/notification/document";
import type UserNotification from "../core/realtime/notification/user";
import type { storeScopeEnum } from "../core/storage/storeScopeEnum";
import type { AuthStrategy } from "./protobuf/syncMessages";
import intersection from "lodash/intersection";
import xor from "lodash/xor";
import type Long from "long";

import type { IKuzzleConfiguration } from "../types/config/KuzzleConfiguration";
import kuzzleStateEnum from "../kuzzle/kuzzleStateEnum";
import createDebug from "../util/debug";
import { fromKoncordeIndex } from "../util/koncordeCompat";
// NOSONAR: `Mutex` is deprecated in favour of `withLock`, but the two use
// incompatible acquisition/TTL formats and must not contend on the same key —
// every node takes "clusterHandshake" with `Mutex`. Deferred to TD-20 (#2688).
import { Mutex } from "../util/mutex"; // NOSONAR
import ClusterCommand from "./command";
import { ClusterIdCardHandler } from "./idCardHandler";
import type { Activity } from "./protobuf/commandMessages";
import ClusterPublisher from "./publisher";
import ClusterState from "./state";
import ClusterSubscriber from "./subscriber";

const debug = createDebug("kuzzle:cluster:sync");

/**
 * Test an IP address and determine if it's in the public or private range.
 *
 * @param  {String}  ip
 * @return {Boolean}
 */
function isPrivateIP(ip: string): boolean {
  if (net.isIPv6(ip)) {
    const prefix = ip.split(":")[0];

    return (
      (prefix.startsWith("fd") && prefix.length === 4) || prefix === "fe80"
    );
  }

  // IPv4
  const exploded = ip.split(".").map((s) => Number.parseInt(s));

  return (
    exploded[0] === 10 ||
    (exploded[0] === 172 && exploded[1] >= 16 && exploded[1] <= 31) ||
    (exploded[0] === 192 && exploded[1] === 168)
  );
}

/**
 * Some IPv4 addresses are reserved for internal uses only, and cannot be
 * reached from other machines. We need to detect and filter them
 * @param  {String}  ip
 * @return {Boolean}
 */
function isInternalIP(ip: string): boolean {
  // To my knowledge, there aren't any reserved, non-loopback and non-routable
  // IPv6 addresses
  if (net.isIPv6(ip)) {
    return false;
  }

  const exploded = ip.split(".").map((s) => Number.parseInt(s));

  // 127.x.x: loopback addresses are already flagged as "internal" by
  // os.networkInterfaces.
  return (
    exploded[0] === 127 ||
    // 169.254.x.x addresses are APIPA addresses: temporary and non-routable.
    // We need to remove them from the accepted list of IP addresses
    // (this is a "just in case" scenario: APIPA addresses are obsolete and
    // should not be used anymore, but we never know...)
    (exploded[0] === 169 && exploded[1] === 254)
  );
}

/**
 * Return the first IP address matching the provided configuration
 * @param  {Object} [options]
 * @param  {String} [options.family] IP family (IPv4 or IPv6)
 * @param  {String} [options.interface] Network interface/IP/MAC to use
 * @param  {String} [options.ip] Used to target public or private addresses
 * @return {String|null}
 */
function getIP({
  family = "IPv4",
  interface: netInterface,
  ip,
}: {
  family?: string;
  interface?: string;
  ip?: string;
} = {}): string | null {
  const mustBePrivate = ip === "private";

  let interfaces = [];

  for (const [key, value] of Object.entries(os.networkInterfaces())) {
    for (const _interface of value) {
      interfaces.push({
        interface: key,
        ..._interface,
      });
    }
  }

  debug("Found interfaces %o", interfaces);

  interfaces = interfaces.filter((n) => {
    return (
      !n.internal &&
      !isInternalIP(n.address) &&
      n.family === family &&
      (!ip || mustBePrivate === isPrivateIP(n.address))
    );
  });

  debug("Filtered interfaces %o", interfaces);

  if (interfaces.length === 0) {
    return null;
  }

  // take the first IP from the list if no interface has been defined
  if (!netInterface) {
    return interfaces[0].address;
  }

  for (const i of interfaces) {
    if ([i.interface, i.address, i.mac].includes(netInterface)) {
      return i.address;
    }
  }

  return null;
}

/** What `trackActivity` records: a node joined, or a node was evicted. */
const nodeActivityEnum = Object.freeze({
  ADDED: 1,
  EVICTED: 2,
});

/** One entry of the cluster activity ring buffer. */
type NodeActivity = Activity;

/** What `cluster:status:get` answers with. */
type ClusterStatus = {
  activeNodes: number;
  activity: Array<{
    address: string;
    date: string;
    event: string;
    id: string;
    reason?: string;
  }>;
  nodes: Array<{ address: string; birthdate: string; id: string }>;
};

// Handles the node logic: discovery, eviction, heartbeat, ...
// Dependencies: core:cache module must be started
class ClusterNode {
  public readonly config: IKuzzleConfiguration["cluster"];

  private readonly logger: ReturnType<typeof global.kuzzle.log.child>;

  public readonly heartbeatDelay: number;

  public readonly ip: string;

  /**
   * Assigned by `handshake()`, from the ID card this node manages to reserve —
   * so it is null until the handshake gets that far. `subscriber.ts` and
   * `command.ts` both declare it a `string`, which is true by the time either
   * of them reads it.
   */
  public nodeId: string;

  private heartbeatTimer: NodeJS.Timeout | null;

  public readonly idCardHandler: ClusterIdCardHandler;

  public readonly publisher: ClusterPublisher;

  public readonly fullState: ClusterState;

  public readonly command: ClusterCommand;

  public readonly eventEmitter: EventEmitter;

  /** Links remote node IDs with their subscriber counterpart */
  public readonly remoteNodes: Map<string, ClusterSubscriber>;

  private readonly activityMaxLength: number;

  /**
   * Cluster nodes activity, used to keep track of nodes being added or
   * removed, to give more insights to cluster statuses
   */
  public activity: NodeActivity[];

  constructor() {
    this.config = global.kuzzle.config.cluster;
    this.logger = global.kuzzle.log.child("cluster:node");
    this.heartbeatDelay = this.config.heartbeat;

    const family = this.config.ipv6 ? "IPv6" : "IPv4";

    this.ip = getIP({
      family,
      interface: this.config.interface,
      ip: this.config.ip,
    });

    debug("Found IP address: %s with config %o", this.ip, this.config);
    assert(
      this.ip !== null,
      `[CLUSTER] No suitable IP address found with the provided configuration (family: ${family}, interface: ${this.config.interface}, ip: ${this.config.ip})`,
    );

    this.nodeId = null;
    this.heartbeatTimer = null;

    this.idCardHandler = new ClusterIdCardHandler(this);
    this.publisher = new ClusterPublisher(this);
    this.fullState = new ClusterState();
    this.command = new ClusterCommand(this);
    this.eventEmitter = new EventEmitter();

    this.remoteNodes = new Map();

    this.activityMaxLength = this.config.activityDepth;
    this.activity = [];
  }

  get syncAddress(): string {
    return `tcp://${this.ip}:${this.config.ports.sync}`;
  }

  async init(): Promise<string> {
    // The publisher needs to be created and initialized before the handshake:
    // other nodes we'll connect to during the handshake will start to subscribe
    // to this node right away
    await this.publisher.init();

    // This also needs to be started before the handshake, as this class handles
    // direct requests to other nodes (needed to request for the full state
    // and to introduce oneself to other nodes)
    await this.command.init();

    global.kuzzle.onPipe("kuzzle:shutdown", () => this.shutdown());

    await this.handshake();

    this.registerEvents();
    this.registerAskEvents();

    if (this.countActiveNodes() < this.config.minimumNodes) {
      this.logger.info(
        "[CLUSTER] Not enough nodes active. Waiting for other nodes to join the cluster...",
      );

      while (this.countActiveNodes() < this.config.minimumNodes) {
        await Bluebird.delay(100);
      }
    }

    return this.nodeId;
  }

  /**
   * Shutdown event: clears all timers, sends a termination status to other
   * nodes, and removes entries from the cache
   */
  async shutdown(): Promise<void> {
    clearInterval(this.heartbeatTimer);
    await this.idCardHandler.dispose();

    for (const subscriber of this.remoteNodes.values()) {
      subscriber.dispose();
    }

    this.publisher.sendNodeShutdown(this.nodeId);

    await this.publisher.dispose();
    this.command.dispose();
  }

  /**
   * Notify other nodes to not evict this node
   *
   * @param {bool} evictionPrevented
   */
  preventEviction(evictionPrevented: boolean): void {
    this.publisher.sendNodePreventEviction(evictionPrevented);
    // This node is subscribed to the other node and might not receive their heartbeat while debugging
    // so this node should not have the responsability of evicting others when his own eviction is prevented
    // when debugging.
    // Otherwise when recovering from a debug session, all the other nodes will be evicted.
    for (const subscriber of this.remoteNodes.values()) {
      subscriber.setEvictionPrevented(evictionPrevented);
    }
  }

  /**
   * Adds a new remote node, and subscribes to it.
   * @param {string} id            - remote node ID
   * @param {string} ip            - remote node IP address
   * @param {number} lastMessageId - remote node last message ID
   * @return {boolean} false if the node was already known, true otherwise
   */
  async addNode(id: string, ip: string, lastMessageId: Long): Promise<boolean> {
    if (this.remoteNodes.has(id)) {
      return false;
    }

    const subscriber = new ClusterSubscriber(this, id, ip);

    this.remoteNodes.set(id, subscriber);
    await subscriber.init();

    // Same ordering `handshake()` needs, and for the same reason: `lastMessageId`
    // reached this node over the *command* channel, in the joining node's
    // handshake, while this subscription lives on the *sync* channel. Until the
    // subscription takes effect the remote's PUB socket drops what it publishes,
    // and `sync()` below would resume from just before the dropped message.
    // TD-65 (#2773).
    const live = await subscriber.waitForSubscription(this.heartbeatDelay * 2);

    if (!live) {
      this.logger.warn(
        `[CLUSTER] No sync message received from node ${id} within ${
          this.heartbeatDelay * 2
        }ms: proceeding with a subscription that is not proven live.`,
      );
    }

    await subscriber.sync(lastMessageId);
    await this.idCardHandler.addNode(id);

    this.logger.info(`[CLUSTER] Node "${id}" joined the cluster`);
    this.trackActivity(id, ip, nodeActivityEnum.ADDED);

    if (
      global.kuzzle.state === kuzzleStateEnum.NOT_ENOUGH_NODES &&
      this.countActiveNodes() >= this.config.minimumNodes
    ) {
      global.kuzzle.state = kuzzleStateEnum.RUNNING;
      this.logger.warn(
        `[CLUSTER] Minimum number of nodes reached (${this.countActiveNodes()}). This node is now accepting requests again.`,
      );
    }

    return true;
  }

  /**
   * Evicts this node from the cluster.
   *
   * @param  {String} reason
   * @param  {Error} [error]
   * @return {void}
   */
  async evictSelf(reason: string, error: Error = null): Promise<void> {
    this.logger.error(`[CLUSTER] ${reason}`);

    if (error) {
      this.logger.error(error.stack);
    }

    this.publisher.sendNodeEvicted(this.nodeId, this.nodeId, reason);

    // The broadcast above tells the *other* nodes to forget this one. It cannot
    // tell this one: a ZeroMQ PUB socket does not deliver to its own process, so
    // `ClusterSubscriber.handleNodeEviction`'s `message.nodeId === localNode
    // .nodeId` branch — the one that shuts the node down — is unreachable by the
    // only node that needs it. Without this call the node leaves the cluster and
    // keeps answering requests behind the load balancer, from state that has
    // stopped advancing. See TD-67 (#2776).
    global.kuzzle.shutdown();
  }

  /**
   * Evicts a remote from the list
   * @param {string}  nodeId - remote node ID
   * @param {Object}  [options]
   * @param {boolean} [options.broadcast] - broadcast the eviction to the cluster
   * @param {string}  [options.reason] - reason of eviction
   */
  async evictNode(
    nodeId: string,
    {
      broadcast = false,
      reason = "",
    }: { broadcast?: boolean; reason?: string },
  ): Promise<void> {
    const subscriber = this.remoteNodes.get(nodeId);

    if (!subscriber) {
      this.logger.warn(
        `[CLUSTER] Node "${nodeId}" with no subscriber evicted. Reason: ${reason}`,
      );
      return;
    }

    this.logger.warn(`[CLUSTER] Node "${nodeId}" evicted. Reason: ${reason}`);

    this.trackActivity(
      nodeId,
      subscriber.remoteNodeIP,
      nodeActivityEnum.EVICTED,
      reason,
    );

    await this.idCardHandler.removeNode(nodeId);
    this.remoteNodes.delete(nodeId);
    this.fullState.removeNode(nodeId);
    subscriber.dispose();

    if (broadcast) {
      this.publisher.sendNodeEvicted(this.nodeId, nodeId, reason);
    }

    if (this.countActiveNodes() < this.config.minimumNodes) {
      global.kuzzle.state = kuzzleStateEnum.NOT_ENOUGH_NODES;
      this.logger.warn(
        `[CLUSTER] Not enough nodes active (expected: ${
          this.config.minimumNodes
        }, active: ${this.countActiveNodes()}). Deactivating node until new ones are added.`,
      );
    }
  }

  /**
   * Verifies the consistency of the cluster by comparing our own known
   * topology with the one kept in other nodes ID cards
   *
   * /!\ Do not wait for this method: it's meant to run as a background check.
   * It'll never throw, and it'll never generate unhandled rejections.
   */
  // NOSONAR (S3776, cognitive complexity 29): the split election below is
  // pre-existing logic this conversion did not write, and it is the code that
  // decides which nodes shut themselves down. Splitting it into helpers is a
  // change to the hardest path in the cluster, and the sprint's rule is that a
  // conversion changes no behaviour. Filed as a refactor rather than done here.
  async enforceClusterConsistency(): Promise<void> {
    // Delay the check to 1 heartbeat round, to allow all nodes to update
    // their ID cards
    await Bluebird.delay(this.heartbeatDelay);

    try {
      const idCards = await this.idCardHandler.getRemoteIdCards();
      idCards.push(this.idCardHandler.idCard);

      let splits = [];

      for (const idCard of idCards) {
        let topology = Array.from(idCard.topology);
        topology.push(idCard.id);

        if (topology.length !== idCards.length) {
          // Explicit comparator rather than the default: identical for these
          // ASCII node ids, and the split election below compares the sorted
          // arrays element by element, so the ordering is load-bearing.
          topology = topology.sort((a, b) => {
            if (a === b) {
              return 0;
            }

            return a < b ? -1 : 1;
          });
          const found = splits.some((split) => {
            if (split.length !== topology.length) {
              return false;
            }

            return split.every((id, index) => id === topology[index]);
          });

          if (!found) {
            splits.push(topology);
          }
        }
      }

      // No split detected, the cluster is consistent
      if (splits.length === 0) {
        return;
      }
      // There is at least 1 cluster split detected.
      //
      // First we elect the smallest split possible.
      // If multiple splits are eligibles, we choose amongst them the split
      // containing the youngest isolated node (isolated = the node is in this
      // split alone, and in no other splits). If no split is eligible using
      // this method, we fall back to the smallest split containing the youngest
      // node (isolated or not).
      //
      // The goal of this process is to force at least 1 node to kill itself,
      // with all nodes concluding on their own on the same list of nodes to
      // shut down.

      // First remove every non existing node from topologies
      splits = splits.map((topology) =>
        topology.filter((nodeId) => idCards.find((card) => card.id === nodeId)),
      );

      splits = splits.sort((a, b) => a.length - b.length);
      const eligibleSplits = splits.filter(
        (split) => split.length === splits[0].length,
      );

      let candidates;

      if (eligibleSplits.length === 1) {
        candidates = eligibleSplits[0];
      } else {
        // Beware: search isolated nodes in ALL the splits, not only the
        // smallest ones
        let isolatedNodes = xor(...splits);
        const eligibleNodes = [...new Set(eligibleSplits.flat())];

        isolatedNodes = intersection(isolatedNodes, eligibleNodes);

        const isIsolated = isolatedNodes.length > 0;

        // safety measure: this should never happen
        if (isolatedNodes.length === 0) {
          isolatedNodes = eligibleNodes;
        }

        let youngestNode;

        for (const isolatedNode of isolatedNodes) {
          const idCard = idCards.find((card) => card.id === isolatedNode);
          if (!youngestNode || idCard.birthdate > youngestNode.birthdate) {
            youngestNode = idCard;
          }
        }

        if (isIsolated) {
          for (let i = 0; !candidates && i < eligibleSplits.length; i++) {
            if (eligibleSplits[i].includes(youngestNode.id)) {
              candidates = intersection(eligibleSplits[i], isolatedNodes);
            }
          }
        } else {
          candidates = [youngestNode.id];
        }
      }

      if (candidates.includes(this.nodeId)) {
        this.logger.error(
          "[CLUSTER] Network split detected. This node is outside the cluster: shutting down.",
        );
        global.kuzzle.shutdown();
        return;
      }
    } catch (err) {
      this.logger.error(
        "[CLUSTER] Unexpected exception caught during a cluster consistency check. Shutting down...",
      );
      this.logger.error(err.stack);
      global.kuzzle.shutdown();
    }
  }

  /**
   * Discovers other active nodes from the cluster and, if other nodes exist,
   * starts a handshake procedure to sync this node and to make it able to
   * handle new client requests
   *
   * @return {void}
   */
  // NOSONAR (S3776, cognitive complexity 26): same as above — the retry loop,
  // the mutex, the timeout and the per-node sync are one interlocking sequence,
  // and TD-65 lives in exactly this ordering. Refactoring it belongs in its own
  // PR, with the functional suite as the witness.
  async handshake(): Promise<void> {
    const handshakeTimeout = setTimeout(() => {
      this.logger.error(
        `[CLUSTER] Failed to join the cluster: timed out (joinTimeout: ${this.config.joinTimeout}ms)`,
      );
      global.kuzzle.shutdown();
    }, this.config.joinTimeout);

    const mutex = new Mutex("clusterHandshake", {
      timeout: this.config.joinTimeout,
    });

    try {
      await mutex.lock();

      // Create the ID Key AFTER the handshake mutex is actually locked,
      // to prevent race conditions (other nodes attempting to connect to this
      // node while it's still initializing)
      await this.idCardHandler.createIdCard();
      debug("[CLUSTER] ID Card created");

      this.nodeId = this.idCardHandler.nodeId;

      await this.startHeartbeat(); // NOSONAR: TD-26
      debug("[CLUSTER] Start heartbeat");

      let retried = false;
      let fullState = null;
      let nodes;

      debug("[CLUSTER] Start retrieving full state..");
      do {
        nodes = await this.idCardHandler.getRemoteIdCards();
        debug("[CLUSTER] %s remote nodes discovered", nodes.length);

        // No other nodes detected = no handshake required
        if (nodes.length === 0) {
          this.trackActivity(this.nodeId, this.ip, nodeActivityEnum.ADDED);
          return;
        }

        // Verify that no other node share the same IP address as this one
        const duplicate = nodes.filter((node) => node.ip === this.ip);

        if (duplicate.length > 0) {
          this.logger.error(
            `[CLUSTER] Another node share the same IP address as this one (${this.ip}): ${duplicate[0].id}. Shutting down.`,
          );
          global.kuzzle.shutdown();
          return;
        }

        // Subscribe to remote nodes and start buffering sync messages.
        //
        // The wait is what makes `getFullState` below safe: it snapshots each
        // node's `lastMessageId` on the *command* channel, and this
        // subscription lives on the *sync* channel, so nothing orders the
        // snapshot after the subscription taking effect. Until it does, the
        // remote's PUB socket drops what it publishes — and this node is then
        // told to resume from just before the dropped message. See TD-65
        // (#2773).
        await Bluebird.map(nodes, async ({ id, ip }) => {
          const subscriber = new ClusterSubscriber(this, id, ip);
          this.remoteNodes.set(id, subscriber);
          await subscriber.init();

          const live = await subscriber.waitForSubscription(
            this.heartbeatDelay * 2,
          );

          if (!live) {
            // Not fatal: a node whose ID card outlived it is exactly what the
            // `fullState === null` retry below exists for. Say so, and let that
            // path decide.
            this.logger.warn(
              `[CLUSTER] No sync message received from node ${id} within ${
                this.heartbeatDelay * 2
              }ms: proceeding with a subscription that is not proven live.`,
            );
          }
        });
        debug("[CLUSTER] Successfully subscribed to nodes");

        fullState = await this.command.getFullState(nodes);

        // Uh oh... no node was able to give us the full state.
        // We must retry later, to check if the redis keys have expired. If they
        // are still there and we still aren't able to fetch a full state, this
        // means we're probably facing a network split, and we must then shut
        // down.
        if (fullState === null) {
          if (retried) {
            this.logger.error(
              "[CLUSTER] Could not connect to discovered cluster nodes (network split detected). Shutting down.",
            );
            global.kuzzle.shutdown();
            return;
          }

          // Disposes all subscribers
          for (const subscriber of this.remoteNodes.values()) {
            subscriber.dispose();
          }
          this.remoteNodes.clear();

          // Waits for a redis heartbeat round
          retried = true;
          const retryDelay = this.heartbeatDelay * 1.5;
          this.logger.warn(
            `[CLUSTER] Unable to connect to discovered cluster nodes. Retrying in ${retryDelay}ms...`,
          );
          await Bluebird.delay(retryDelay);
        }
      } while (fullState === null);
      debug("[CLUSTER] Fullstate retrieved, loading into node..");

      await this.fullState.loadFullState(fullState); // NOSONAR: TD-26
      this.activity = fullState.activity ? fullState.activity : this.activity;

      debug("[CLUSTER] Fullstate loaded.");

      const handshakeResponses = await this.command.broadcastHandshake(nodes);

      debug("[CLUSTER] Successful handshakes with other nodes.");

      // Update subscribers: start synchronizing, or unsubscribes from nodes who
      // didn't respond
      for (const [nodeId, handshakeData] of Object.entries(
        handshakeResponses,
      )) {
        const subscriber = this.remoteNodes.get(nodeId);
        if (handshakeData === null) {
          subscriber.dispose();
          this.remoteNodes.delete(nodeId);
        } else {
          await this.idCardHandler.addNode(nodeId);
          const nodesStates = fullState.nodesState || [];
          const nodeStatus = nodesStates.find((node) => node.id === nodeId);
          // Awaited: `sync()` replays the buffered messages, and a gap found
          // there evicts this node. Fired and forgotten, it used to print
          // "Successfully completed the handshake" 2ms AFTER the eviction that
          // contradicts it — a log describing a state the code is not in.
          const synced = await subscriber.sync(
            nodeStatus ? nodeStatus.lastMessageId : handshakeData.lastMessageId,
          );

          if (synced) {
            this.logger.info(
              `[CLUSTER] Successfully completed the handshake with node ${nodeId}`,
            );
          }
        }
      }

      // `createIdCard()` adopts `global.nodeId`, so these are normally the same
      // string and the line reads as one name (TD-59, #2764). They still differ
      // in the two cases the adoption cannot cover — a stale IdCard holding the
      // key, and a Kuzzle running without a Backend — and those are exactly the
      // cases where a reader needs to be told, so the line says both.
      this.logger.info(
        global.nodeId && global.nodeId !== this.nodeId
          ? `[CLUSTER] Successfully joined the cluster as "${this.nodeId}" (process node id: ${global.nodeId}).`
          : `[CLUSTER] Successfully joined the cluster as "${this.nodeId}".`,
      );
      this.trackActivity(this.nodeId, this.ip, nodeActivityEnum.ADDED);
    } finally {
      clearTimeout(handshakeTimeout);
      await mutex.unlock();
    }
  }

  countActiveNodes(): number {
    return this.remoteNodes.size + 1;
  }

  startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.publisher.sendHeartbeat(this.syncAddress);
    }, this.heartbeatDelay);
  }

  /**
   * Cluster activity tracking
   *
   * @param {string} id
   * @param {string} ip
   * @param {nodeActivityEnum} event
   * @param {string} [reason]
   */
  trackActivity(id: string, ip: string, event: number, reason?: string): void {
    if (this.activity.length > this.activityMaxLength) {
      this.activity.shift();
    }

    this.activity.push({
      address: ip,
      date: new Date().toISOString(),
      event,
      id,
      reason,
    });
  }

  /**
   * Returns the full status of the cluster
   * @return {Object}
   */
  async getStatus(): Promise<ClusterStatus> {
    const status: ClusterStatus = {
      activeNodes: 0,
      activity: this.activity.map(({ address, date, event, id, reason }) => ({
        address,
        date,
        event: event === nodeActivityEnum.ADDED ? "joined" : "evicted",
        id,
        reason,
      })),
      nodes: [],
    };
    const idCards = await this.idCardHandler.getRemoteIdCards();
    idCards.push(this.idCardHandler.idCard);

    for (const idCard of idCards) {
      status.nodes.push({
        address: idCard.ip,
        birthdate: new Date(idCard.birthdate).toISOString(),
        id: idCard.id,
      });
    }

    status.activeNodes = status.nodes.length;

    return status;
  }

  /**
   * Registers ask events
   */
  registerAskEvents(): void {
    global.kuzzle.onAsk("cluster:node:preventEviction", (state) => {
      this.preventEviction(state);
    });

    /**
     * Removes a room from the full state, and only for this node.
     * Removes the room from Koncorde if, and only if, no other node uses it.
     *
     * @param  {string} roomId
     * @return {void}
     */
    global.kuzzle.onAsk("cluster:realtime:room:remove", (roomId) =>
      this.removeRealtimeRoom(roomId),
    );

    /**
     * Returns the total number of subscribers on all nodes for the provided
     * room
     *
     * @param {string} roomId
     * @returns {Number}
     */
    global.kuzzle.onAsk("cluster:realtime:room:count", (roomId) =>
      this.countRealtimeSubscribers(roomId),
    );

    /**
     * Returns the list of existing rooms in the cluster
     *
     * @returns {Object}
     */
    global.kuzzle.onAsk("cluster:realtime:room:list", () =>
      this.fullState.listRealtimeRooms(),
    );

    /**
     * Returns the requested room. Used to create a room on the fly on this node
     * if it exists only on remote nodes (e.g. for the realtime:join API action)
     *
     * @param {string} roomId
     * @returns {NormalizedFilter}
     */
    global.kuzzle.onAsk("cluster:realtime:filters:get", (roomId) =>
      this.fullState.getNormalizedFilters(roomId),
    );

    /**
     * Broadcasts an event to other nodes
     *
     * @param {string} event name
     * @param {Object} payload - event payload
     */
    global.kuzzle.onAsk("cluster:event:broadcast", (event, payload) =>
      this.broadcast(event, payload),
    );

    /**
     * Listens to a cluster-wide event
     *
     * @param {string} event name
     * @param {Function} fn - event listener
     */
    global.kuzzle.onAsk("cluster:event:on", (event, fn) =>
      this.eventEmitter.on(event, fn),
    );

    /**
     * Listens to a cluster-wide event once.
     *
     * @param {string} event name
     * @param {Function} fn - event listener
     */
    global.kuzzle.onAsk("cluster:event:once", (event, fn) =>
      this.eventEmitter.once(event, fn),
    );

    /**
     * Removes a listener from an event
     *
     * @param {string} event name
     * @param {Function} fn - event listener
     */
    global.kuzzle.onAsk("cluster:event:off", (event, fn) =>
      this.eventEmitter.removeListener(event, fn),
    );

    /**
     * Removes all listeners from an event
     *
     * @param {string} event name
     */
    global.kuzzle.onAsk("cluster:event:removeAllListeners", (event) =>
      this.eventEmitter.removeAllListeners(event),
    );

    /**
     * Returns the full status of the cluster
     */
    global.kuzzle.onAsk("cluster:status:get", () => this.getStatus());
  }

  /**
   * Starts listening to events to trigger sync messages on state changes.
   *
   * @return {void}
   */
  registerEvents(): void {
    global.kuzzle.on("admin:afterRefreshIndexCache", () =>
      this.onIndexCacheRefreshed(),
    );

    global.kuzzle.onCall("core:realtime:room:create:after", (payload) =>
      this.onNewRealtimeRoom(payload),
    );

    global.kuzzle.onCall("core:realtime:subscribe:after", (roomId) =>
      this.onNewSubscription(roomId),
    );

    global.kuzzle.onCall("core:realtime:unsubscribe:after", (roomId) =>
      this.onUnsubscription(roomId),
    );

    global.kuzzle.on("core:notify:document", ({ notification, rooms }) => {
      this.onDocumentNotification(rooms, notification);
    });

    global.kuzzle.on("core:notify:user", ({ notification, room }) =>
      this.onUserNotification(room, notification),
    );

    global.kuzzle.on(
      "core:auth:strategyAdded",
      ({ name, pluginName, strategy }) => {
        this.onAuthStrategyAdded(name, pluginName, strategy);
      },
    );

    global.kuzzle.on("core:auth:strategyRemoved", ({ name, pluginName }) =>
      this.onAuthStrategyRemoved(name, pluginName),
    );

    global.kuzzle.on("admin:afterDump", (request) => {
      const suffix = request.getString("suffix", "manual-api-action");

      return this.onDumpRequest(suffix);
    });

    global.kuzzle.on("admin:afterResetSecurity", () => this.onSecurityReset());

    global.kuzzle.on("admin:afterShutdown", () => this.onShutdown());

    global.kuzzle.on("collection:afterDeleteSpecifications", () =>
      this.onValidatorsChanged(),
    );

    global.kuzzle.on("collection:afterUpdateSpecifications", () =>
      this.onValidatorsChanged(),
    );

    // Profile change events
    global.kuzzle.on("core:security:profile:create", ({ args: [profileId] }) =>
      this.onProfileChanged(profileId),
    );

    global.kuzzle.on(
      "core:security:profile:createOrReplace",
      ({ args: [profileId] }) => this.onProfileChanged(profileId),
    );

    global.kuzzle.on("core:security:profile:update", ({ args: [profileId] }) =>
      this.onProfileChanged(profileId),
    );

    global.kuzzle.on("core:security:profile:delete", ({ args: [profileId] }) =>
      this.onProfileChanged(profileId),
    );

    // Role change events
    global.kuzzle.on("core:security:role:create", ({ args: [roleId] }) =>
      this.onRoleChanged(roleId),
    );

    global.kuzzle.on(
      "core:security:role:createOrReplace",
      ({ args: [roleId] }) => this.onRoleChanged(roleId),
    );

    global.kuzzle.on("core:security:role:update", ({ args: [roleId] }) =>
      this.onRoleChanged(roleId),
    );

    global.kuzzle.on("core:security:role:delete", ({ args: [roleId] }) =>
      this.onRoleChanged(roleId),
    );

    // Index cache change events
    global.kuzzle.on("core:storage:index:create:after", ({ index, scope }) =>
      this.onIndexAdded(scope, index),
    );

    global.kuzzle.on("core:storage:index:delete:after", ({ index, scope }) =>
      this.onIndexesRemoved(scope, [index]),
    );

    global.kuzzle.on("core:storage:index:mDelete:after", ({ indexes, scope }) =>
      this.onIndexesRemoved(scope, indexes),
    );

    global.kuzzle.on(
      "core:storage:collection:create:after",
      ({ collection, index, scope }) => {
        this.onCollectionAdded(scope, index, collection);
      },
    );

    global.kuzzle.on(
      "core:storage:collection:delete:after",
      ({ collection, index, scope }) => {
        this.onCollectionRemoved(scope, index, collection);
      },
    );
  }

  /**
   * Triggered whenever a realtime room is created on this node
   *
   * @param  {NormalizedFilter} payload
   * @return {void}
   */
  onNewRealtimeRoom(payload: NormalizedFilter): void {
    const roomMessageId = this.publisher.sendNewRealtimeRoom(payload);

    debug(
      "[%s] Broadcasting new realtime room %s (message: %d)",
      this.nodeId,
      payload.id,
      roomMessageId,
    );

    const icpair = fromKoncordeIndex(payload.index);

    this.fullState.addRealtimeRoom(
      payload.id,
      icpair.index,
      icpair.collection,
      payload.filter,
      {
        messageId: roomMessageId,
        nodeId: this.nodeId,
        subscribers: 0,
      },
    );
  }

  /**
   * Triggered on a new realtime subscription
   *
   * @param  {string} roomId
   * @return {void}
   */
  onNewSubscription(roomId: string): void {
    const subMessageId = this.publisher.sendSubscription(roomId);

    debug(
      "[%s] Broadcasting new realtime subscription on room %s (message: %d)",
      this.nodeId,
      roomId,
      subMessageId,
    );

    this.fullState.addRealtimeSubscription(roomId, this.nodeId, subMessageId);
  }

  /**
   * Triggered when a realtime room is removed from this node.
   *
   * @param  {string} roomId
   * @return {void}
   */
  removeRealtimeRoom(roomId: string): void {
    const messageId = this.publisher.sendRemoveRealtimeRoom(roomId);

    debug(
      "[%s] Broadcasted the removal of room %s (message: %d)",
      this.nodeId,
      roomId,
      messageId,
    );

    this.fullState.removeRealtimeRoom(roomId, this.nodeId);
  }

  /**
   * Broadcasts an event to other nodes
   *
   * @param {string} event name
   * @param {Object} payload - event payload
   */
  broadcast(event: string, payload: unknown): void {
    const messageId = this.publisher.sendClusterWideEvent(event, payload);

    debug(
      '[%s] Emitted cluster-wide event "%s" (message: %d)',
      this.nodeId,
      event,
      messageId,
    );
  }

  /**
   * Triggered when a user unsubscribes from a room
   *
   * @param  {string} roomId
   * @return {void}
   */
  onUnsubscription(roomId: string): void {
    const messageId = this.publisher.sendUnsubscription(roomId);

    debug(
      "[%s] Broadcasting realtime unsubscription on room %s (message: %d)",
      this.nodeId,
      roomId,
      messageId,
    );

    this.fullState.removeRealtimeSubscription(roomId, this.nodeId, messageId);
  }

  /**
   * Triggered when a document notification must be propagated
   *
   * @param  {Array.<string>} rooms - list of rooms to notify
   * @param  {DocumentNotification} notification
   * @return {void}
   */
  onDocumentNotification(
    rooms: string[],
    notification: DocumentNotification,
  ): void {
    this.publisher.sendDocumentNotification(rooms, notification);
  }

  /**
   * Triggered when a user notification must be propagated
   *
   * @param  {string} room
   * @param  {UserNotification} notification
   * @return {void}
   */
  onUserNotification(room: string, notification: UserNotification): void {
    this.publisher.sendUserNotification(room, notification);
  }

  /**
   * Triggered when a new authentication strategy has been dynamically added
   *
   * @param  {string} strategyName
   * @param  {string} pluginName
   * @param  {Object} strategyObject
   * @return {void}
   */
  onAuthStrategyAdded(
    strategyName: string,
    pluginName: string,
    strategyObject: AuthStrategy,
  ): void {
    this.publisher.sendNewAuthStrategy(
      strategyName,
      pluginName,
      strategyObject,
    );

    this.fullState.addAuthStrategy({
      pluginName,
      strategy: strategyObject,
      strategyName,
    });
  }

  /**
   * Triggered when an authentication strategy has been dynamically removed
   *
   * @param  {string} strategyName
   * @param  {string} pluginName
   * @return {void}
   */
  onAuthStrategyRemoved(strategyName: string, pluginName: string): void {
    this.publisher.sendRemoveAuthStrategy(strategyName, pluginName);

    this.fullState.removeAuthStrategy(strategyName);
  }

  /**
   * Triggered when a dump has been requested
   *
   * @param  {string} suffix
   * @return {void}
   */
  onDumpRequest(suffix: string): void {
    this.publisher.sendDumpRequest(suffix);
  }

  /**
   * Triggered when security rights have been reset
   *
   * @return {void}
   */
  onSecurityReset(): void {
    this.publisher.send("ResetSecurity", {});
  }

  /**
   * Triggered when a document validator has changed
   *
   * @return {void}
   */
  onValidatorsChanged(): void {
    this.publisher.send("RefreshValidators", {});
  }

  /**
   * Triggered when a profile has changed
   *
   * @param  {string} profileId
   * @return {void}
   */
  onProfileChanged(profileId: string): void {
    this.publisher.send("InvalidateProfile", { profileId });
  }

  /**
   * Triggered when a role has changed
   *
   * @param {string} roleId
   * @return {void}
   */
  onRoleChanged(roleId: string): void {
    this.publisher.send("InvalidateRole", { roleId });
  }

  /**
   * Triggered when an index has been added to the index cache
   *
   * @param  {storeScopeEnum} scope
   * @param  {string} index
   * @return {void}
   */
  onIndexAdded(scope: storeScopeEnum, index: string): void {
    this.publisher.sendAddIndex(scope, index);
  }

  /**
   * Triggered when a collection has been added to the index cache
   *
   * @param  {storeScopeEnum} scope
   * @param  {string} index
   * @param  {string} collection
   * @return {void}
   */
  onCollectionAdded(
    scope: storeScopeEnum,
    index: string,
    collection: string,
  ): void {
    this.publisher.sendAddCollection(scope, index, collection);
  }

  /**
   * Triggered when index have been removed from the index cache
   *
   * @param  {storeScopeEnum} scope
   * @param  {Array.<string>} indexes
   * @return {void}
   */
  onIndexesRemoved(scope: storeScopeEnum, indexes: string[]): void {
    this.publisher.sendRemoveIndexes(scope, indexes);
  }

  /**
   * Triggered when a collection has been removed from the index cache
   *
   * @param  {storeScopeEnum} scope
   * @param  {string} index
   * @param  {string} collection
   * @return {void}
   */
  onCollectionRemoved(
    scope: storeScopeEnum,
    index: string,
    collection: string,
  ): void {
    this.publisher.sendRemoveCollection(scope, index, collection);
  }

  /**
   * Triggered when a cluster-wide shutdown has been initiated
   *
   * @return {void}
   */
  onShutdown(): void {
    this.publisher.send("Shutdown", {});
  }

  /**
   * Triggered when the index cache has been manually refreshed
   */
  onIndexCacheRefreshed(): void {
    this.publisher.send("RefreshIndexCache", {});
  }

  /**
   * Returns the total number of subscribers on the cluster for the provided
   * room
   *
   * @param {string} roomId
   * @return {void}
   */
  async countRealtimeSubscribers(roomId: string): Promise<number> {
    return this.fullState.countRealtimeSubscriptions(roomId);
  }
}

export = ClusterNode;

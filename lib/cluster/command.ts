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
import type Long from "long";
import * as protobuf from "protobufjs";
import { Reply, Request } from "zeromq";

import type { SerializedState } from "./state";
import type {
  Activity,
  Decoded,
  FullStateResponse,
  HandshakeRequest,
  HandshakeResponse,
} from "./protobuf/commandMessages";
import { commandTopic } from "./protobuf/commandMessages";

/**
 * Annotated `number` rather than left to infer `1 | 2 | 3`: `state` is moved to
 * `CLOSED` by `dispose()` while `listen()` is awaiting a socket read, and
 * TypeScript's control-flow narrowing does not model that. Under the literal
 * types the `while (state === RUNNING)` loop narrows `state` to `RUNNING`
 * inside its own body, and the deliberate `state !== CLOSED` re-check after the
 * `await` is then reported as a comparison with no overlap. That re-check is
 * the point: it is how a socket error during shutdown is told apart from a real
 * one.
 */
/* eslint-disable sort-keys */
const stateEnum: { INITIALIZING: number; RUNNING: number; CLOSED: number } =
  Object.freeze({
    INITIALIZING: 1,
    RUNNING: 2,
    CLOSED: 3,
  });
/* eslint-enable sort-keys */

/**
 * What the command layer needs from the node that owns it. Declared
 * structurally rather than as `ClusterNode` because `node.ts` imports this
 * file: naming the class here would close the cycle.
 */
type CommandingNode = {
  /**
   * Only the two settings this file reads, not the whole cluster config: the
   * real `IKuzzleConfiguration["cluster"]` satisfies this structurally, and
   * stating it this way makes a widening of the coupling visible instead of
   * silent.
   */
  config: {
    ports: { command: number };
    syncTimeout: number;
  };
  ip: string;
  nodeId: string;
  activity: Activity[];
  /** Only `serialize()`: the command layer never mutates the state. */
  fullState: { serialize(): SerializedState };
  publisher: { lastMessageId: Long };
  remoteNodes: Map<string, { lastMessageId: Long }>;
  addNode(id: string, ip: string, lastMessageId: Long): Promise<boolean>;
};

/**
 * The handshake responses `broadcastHandshake()` returns, keyed by node id. A
 * `null` means the node never answered, and its caller disposes of it.
 */
type HandshakeResponses = Record<string, Decoded<HandshakeResponse> | null>;

// Handles bidirectional requests between this node and other nodes
class ClusterCommand {
  private readonly node: CommandingNode;

  private server: Reply | null;

  private protoroot: protobuf.Root | null;

  /**
   * One of `stateEnum`'s values. `number` and not the literal union for the
   * same reason as `subscriber.ts`'s `state`: `dispose()` moves it to `CLOSED`
   * while `listen()` is awaiting a socket read, which control-flow narrowing
   * does not model — it would report the deliberate re-check after the `await`
   * as an impossible comparison.
   */
  private state: number;

  private readonly logger: ReturnType<typeof global.kuzzle.log.child>;

  /**
   * @param localNode the cluster node this command layer belongs to
   */
  constructor(localNode: CommandingNode) {
    this.node = localNode;
    this.server = null;
    this.protoroot = null;

    this.state = stateEnum.INITIALIZING;
    this.logger = global.kuzzle.log.child("cluster:command");
  }

  async init(): Promise<void> {
    this.protoroot = await protobuf.load(`${__dirname}/protobuf/command.proto`);
    await this.serve();

    this.listen();
  }

  async serve(): Promise<void> {
    this.server = new Reply();
    await this.server.bind(`tcp://*:${this.node.config.ports.command}`);
  }

  /**
   * Listens to incoming requests and answer to them.
   * Do NOT await this method, it's meant to run indefinitely until the close()
   * method is invoked.
   * This method can (and should) never return a rejected promise.
   */
  async listen(): Promise<void> {
    this.state = stateEnum.RUNNING;

    while (this.state === stateEnum.RUNNING) {
      try {
        const [type, data] = await this.server.receive();

        switch (type.toString()) {
          case commandTopic.FULLSTATE:
            await this.sendFullState();
            break;
          case commandTopic.HANDSHAKE:
            await this.handleHandshake(data);
            break;
          default:
            // REP/REQ sockets expect a reply to each request made, so we have
            // to send some kind of response on an invalid request received
            await this.server.send([commandTopic.DISCARDED, null]);
        }
      } catch (e) {
        if (this.state !== stateEnum.CLOSED) {
          throw e;
        }
      }
    }
  }

  /**
   * Closes opened sockets and marks this server as closed.
   */
  dispose(): void {
    this.state = stateEnum.CLOSED;
    this.server.close();
  }

  /**
   * Sends back the full state to the requesting node
   */
  async sendFullState(): Promise<void> {
    const serialized = this.node.fullState.serialize();

    const nodesState = [];

    for (const [id, subscriber] of this.node.remoteNodes.entries()) {
      nodesState.push({ id, lastMessageId: subscriber.lastMessageId });
    }

    nodesState.push({
      id: this.node.nodeId,
      lastMessageId: this.node.publisher.lastMessageId,
    });

    const fullState: FullStateResponse = {
      activity: this.node.activity,
      authStrategies: serialized.authStrategies,
      nodesState,
      rooms: serialized.rooms,
    };

    const protoEncode = this.protoroot.lookupType("FullStateResponse");
    const buffer = protoEncode.encode(protoEncode.create(fullState)).finish();

    await this.server.send([commandTopic.FULLSTATE, buffer]);
  }

  /**
   * Handles a handshake request from a remote node
   */
  async handleHandshake(data: Buffer): Promise<void> {
    const decoder = this.protoroot.lookupType("HandshakeRequest");
    // Annotated, not asserted: `toObject()` returns an index-signature object,
    // so the schema type is a declaration of what the wire carries rather than
    // a claim overriding the compiler. Same shape as `subscriber.ts`.
    const request: Decoded<HandshakeRequest> = decoder.toObject(
      decoder.decode(data),
    );
    const { nodeId, ip, lastMessageId } = request;

    const added = await this.node.addNode(nodeId, ip, lastMessageId);

    const encoder = this.protoroot.lookupType("HandshakeResponse");
    const response: HandshakeResponse = {
      added,
      lastMessageId: this.node.publisher.lastMessageId,
    };

    const buffer = encoder.encode(encoder.create(response)).finish();

    await this.server.send([commandTopic.HANDSHAKE, buffer]);
  }

  /**
   * Request the full state from ONE of the remote nodes of the cluster, AT
   * RANDOM (necessary to make sure we distribute the full state serialization
   * load across all nodes)
   *
   * @returns the fetched full state, or null if no node answered
   */
  async getFullState(
    nodes: Array<{ id: string; ip: string }>,
  ): Promise<Decoded<FullStateResponse> | null> {
    let idx = Math.floor(Math.random() * Math.floor(nodes.length));
    let fullState = null;

    for (
      let retries = 0;
      fullState === null && retries < nodes.length;
      retries++
    ) {
      const { id, ip } = nodes[idx];
      const req = new Request();

      req.receiveTimeout = this.node.config.syncTimeout;

      req.connect(`tcp://${ip}:${this.node.config.ports.command}`);

      // No payload message for a full state request
      await req.send([commandTopic.FULLSTATE, null]);

      try {
        [, fullState] = await req.receive();
      } catch {
        // no response from the remote node in a timely fashion... retrying
        // with another one
        this.logger.warn(
          `Unable to fetch a full state from node ${id} (no response received)`,
        );
        idx = (idx + 1) % nodes.length;
      } finally {
        req.close();
      }
    }

    if (fullState === null) {
      return null;
    }

    const decoder = this.protoroot.lookupType("FullStateResponse");
    const decoded: Decoded<FullStateResponse> = decoder.toObject(
      decoder.decode(fullState),
    );

    return decoded;
  }

  /**
   * Sends a handshake request to other remote nodes and process their response
   *
   * @returns one entry per node: its decoded response, or `null` if it never
   *          answered (the node is probably dead)
   */
  async broadcastHandshake(
    nodes: Array<{ id: string; ip: string }>,
  ): Promise<HandshakeResponses> {
    const payload: HandshakeRequest = {
      ip: this.node.ip,
      lastMessageId: this.node.publisher.lastMessageId,
      nodeId: this.node.nodeId,
    };

    const encoder = this.protoroot.lookupType("HandshakeRequest");
    const encoded = encoder.encode(encoder.create(payload)).finish();

    const responses = await Bluebird.map(nodes, ({ id, ip }) =>
      this._sendSingleHandshake(id, ip, encoded),
    );

    const decoder = this.protoroot.lookupType("HandshakeResponse");
    const result: HandshakeResponses = {};

    for (let i = 0; i < nodes.length; i++) {
      const response = responses[i];

      if (response === null) {
        result[nodes[i].id] = null;
        continue;
      }

      const decoded: Decoded<HandshakeResponse> = decoder.toObject(
        decoder.decode(response),
      );

      result[nodes[i].id] = decoded;
    }

    return result;
  }

  /**
   * Sends a handshake payload to a remote node, and waits for its response
   *
   * @param id      remote node ID
   * @param ip      remote node IP address
   * @param payload handshake payload (protobuf encoded)
   * @returns the handshake encoded response, or null if none was received
   */
  async _sendSingleHandshake(
    id: string,
    ip: string,
    payload: Uint8Array,
  ): Promise<Buffer | null> {
    const req = new Request();

    req.receiveTimeout = 2000;

    req.connect(`tcp://${ip}:${this.node.config.ports.command}`);

    await req.send([commandTopic.HANDSHAKE, payload]);

    let response = null;

    try {
      [, response] = await req.receive();
    } catch {
      this.logger.warn(
        `Couldn't complete handshake with node ${id}: no response received`,
      );
    } finally {
      req.close();
    }

    return response;
  }
}

export = ClusterCommand;

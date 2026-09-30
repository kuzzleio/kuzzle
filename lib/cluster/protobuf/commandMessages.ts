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

import type Long from "long";

import type { NewAuthStrategyMessage } from "./syncMessages";

/**
 * The shapes `command.proto` puts on the wire, as `protobufjs`' `toObject()`
 * returns them.
 *
 * Same contract as [`syncMessages.ts`](./syncMessages.ts): `command.proto` is
 * the source of truth and these types mirror it field for field, so the command
 * layer is checked against the schema rather than against a reader's memory of
 * it. Keep them in step with the `.proto`.
 *
 * The two decoding details `syncMessages.ts` documents apply here too: a proto
 * `uint64` comes back as a **`Long`** (`lastMessageId`, `messageId`), a `uint32`
 * as a plain number (`subscribers`, `event`), and a field the schema comments as
 * needing to be "stringified beforehand" is a **string** its reader parses.
 */

/**
 * A message as `toObject()` hands it back, before anything has established that
 * its fields are there. Every proto3 field is optional on the wire, and
 * `toObject()` returns an index-signature object — so this is what a decode
 * actually yields, and narrowing it is the reader's job. `subscriber.ts`'s
 * `DecodedMessage` is the same admission for `sync.proto`.
 */
export type Decoded<T> = Partial<T> & Record<string, unknown>;

/** `FullStateResponse.NodeSubscribers` — who subscribed to a realtime room. */
export type NodeSubscribers = {
  nodeId: string;
  subscribers: number;
  messageId: Long;
};

/** `FullStateResponse.RealtimeRoom`. */
export type RealtimeRoom = {
  roomId: string;
  index: string;
  collection: string;
  /**
   * Serialized JSON. The schema says so explicitly: protobuf cannot carry an
   * array of polymorphic objects, so the filters travel stringified.
   */
  filters: string;
  nodes: NodeSubscribers[];
};

/**
 * `FullStateResponse.Activity`. `event` is a `nodeActivityEnum` value, which
 * the schema can only express as a `uint32`.
 */
export type Activity = {
  id: string;
  date: string;
  address: string;
  event: number;
  reason?: string;
};

/** `FullStateResponse.NodeState` — a node and the last message it published. */
export type NodeState = {
  id: string;
  lastMessageId: Long;
};

/**
 * `command.proto` declares `authStrategies` as `repeated sync.NewAuthStrategy`,
 * but the `messageId` that message carries is **never populated on this path**:
 * the full state stores the strategy triple exactly as `addAuthStrategy()`
 * received it, with no message id. The schema reuses a type that has a field
 * this payload has no value for; the `Omit` says so rather than inventing one.
 */
export type FullStateAuthStrategy = Omit<NewAuthStrategyMessage, "messageId">;

export type FullStateResponse = {
  rooms: RealtimeRoom[];
  authStrategies: FullStateAuthStrategy[];
  activity: Activity[];
  nodesState: NodeState[];
};

export type HandshakeRequest = {
  nodeId: string;
  lastMessageId: Long;
  ip: string;
};

export type HandshakeResponse = {
  added: boolean;
  lastMessageId: Long;
};

/**
 * The topics the command REP/REQ socket answers on. `DISCARDED` is the reply to
 * anything else: REQ/REP requires a reply to every request, so an unknown topic
 * still gets an (empty) answer rather than leaving the peer waiting.
 */
export type RetransmitRequest = {
  from: Long;
  to: Long;
};

/** One sync message as it was published: its topic and its encoded payload. */
export type RetransmitFrame = {
  topic: string;
  data: Uint8Array;
};

export type RetransmitResponse = {
  frames: RetransmitFrame[];
};

export const commandTopic = Object.freeze({
  DISCARDED: "discarded",
  FULLSTATE: "fullstate",
  HANDSHAKE: "handshake",
  RETRANSMIT: "retransmit",
});

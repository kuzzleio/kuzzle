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

/**
 * The shapes `sync.proto` puts on the wire, as `protobufjs`' `toObject()`
 * returns them.
 *
 * `sync.proto` is the source of truth: these types mirror it field for field
 * and exist so the cluster's message handlers are checked against the schema
 * rather than against a reader's memory of it. Keep them in step with the
 * `.proto` — a field added there and forgotten here is a field the compiler
 * will say does not exist.
 *
 * Two decoding details are load-bearing:
 * - a proto `uint64` comes back as a **`Long`**, not a number, because the
 *   `long` package is installed (`messageId` and `timestamp`);
 * - a proto `uint32` comes back as a plain number (`status`);
 * - fields commented "serialized JSON" in the schema are **strings** here, and
 *   every handler that reads one calls `JSON.parse` on it.
 */

/**
 * Every sync message carries a `messageId`: it is what lets a subscriber detect
 * that it missed one. `sync.proto` states the rule in its header comment, and
 * `validateMessage()` enforces it on the wire.
 */
export type SyncMessage = {
  messageId: Long;
};

export type HeartbeatMessage = SyncMessage & {
  address: string;
};

export type NodeEvictedMessage = SyncMessage & {
  nodeId: string;
  reason: string;
  evictor: string;
};

export type NodeShutdownMessage = SyncMessage & {
  nodeId: string;
};

export type NodePreventEvictionMessage = SyncMessage & {
  evictionPrevented: boolean;
};

export type NewRealtimeRoomMessage = SyncMessage & {
  /** Koncorde index, i.e. an index/collection pair encoded as one string */
  index: string;
  id: string;
  /** serialized JSON */
  filter: string;
};

export type RemoveRealtimeRoomMessage = SyncMessage & {
  roomId: string;
};

export type SubscriptionMessage = SyncMessage & {
  roomId: string;
};

export type UnsubscriptionMessage = SyncMessage & {
  roomId: string;
};

export type DocumentNotificationMessage = SyncMessage & {
  rooms: string[];
  status: number;
  requestId: string;
  timestamp: Long;
  index: string;
  collection: string;
  controller: string;
  action: string;
  protocol: string;
  scope: string;
  /** serialized JSON */
  volatile: string;
  /** serialized JSON */
  result: string;
};

export type UserNotificationMessage = SyncMessage & {
  room: string;
  status: number;
  timestamp: Long;
  index: string;
  collection: string;
  controller: string;
  action: string;
  protocol: string;
  user: string;
  /** serialized JSON */
  volatile: string;
  /** serialized JSON */
  result: string;
};

export type AuthStrategyConfig = {
  authenticator: string;
  fields: string[];
  /** serialized JSON */
  authenticateOptions: string;
  /** serialized JSON */
  strategyOptions: string;
};

export type AuthStrategyMethods = {
  create: string;
  delete: string;
  exists: string;
  update: string;
  validate: string;
  verify: string;
  getById?: string;
  getInfo?: string;
  afterRegister?: string;
};

export type AuthStrategy = {
  methods: AuthStrategyMethods;
  config: AuthStrategyConfig;
};

export type NewAuthStrategyMessage = SyncMessage & {
  strategyName: string;
  pluginName: string;
  strategy: AuthStrategy;
};

export type RemoveAuthStrategyMessage = SyncMessage & {
  strategyName: string;
  pluginName: string;
};

export type DumpRequestMessage = SyncMessage & {
  suffix: string;
};

export type ResetSecurityMessage = SyncMessage;

export type ShutdownMessage = SyncMessage;

export type RefreshValidatorsMessage = SyncMessage;

export type RefreshIndexCacheMessage = SyncMessage;

export type InvalidateProfileMessage = SyncMessage & {
  profileId: string;
};

export type InvalidateRoleMessage = SyncMessage & {
  roleId: string;
};

export type AddIndexMessage = SyncMessage & {
  scope: string;
  index: string;
};

export type AddCollectionMessage = SyncMessage & {
  scope: string;
  index: string;
  collection: string;
};

export type RemoveIndexesMessage = SyncMessage & {
  scope: string;
  indexes: string[];
};

export type RemoveCollectionMessage = SyncMessage & {
  scope: string;
  index: string;
  collection: string;
};

export type ClusterWideEventMessage = SyncMessage & {
  event: string;
  /** serialized JSON */
  payload: string;
};

/**
 * Topic name → the message that topic carries. A topic is a protobuf type name,
 * so this map is the same list as `sync.proto`'s, and `ClusterSubscriber`'s
 * handler table is typed against it: a handler registered under the wrong topic
 * stops compiling.
 */
export type SyncMessages = {
  AddCollection: AddCollectionMessage;
  AddIndex: AddIndexMessage;
  ClusterWideEvent: ClusterWideEventMessage;
  DocumentNotification: DocumentNotificationMessage;
  DumpRequest: DumpRequestMessage;
  Heartbeat: HeartbeatMessage;
  InvalidateProfile: InvalidateProfileMessage;
  InvalidateRole: InvalidateRoleMessage;
  NewAuthStrategy: NewAuthStrategyMessage;
  NewRealtimeRoom: NewRealtimeRoomMessage;
  NodeEvicted: NodeEvictedMessage;
  NodePreventEviction: NodePreventEvictionMessage;
  NodeShutdown: NodeShutdownMessage;
  RefreshIndexCache: RefreshIndexCacheMessage;
  RefreshValidators: RefreshValidatorsMessage;
  RemoveAuthStrategy: RemoveAuthStrategyMessage;
  RemoveCollection: RemoveCollectionMessage;
  RemoveIndexes: RemoveIndexesMessage;
  RemoveRealtimeRoom: RemoveRealtimeRoomMessage;
  ResetSecurity: ResetSecurityMessage;
  Shutdown: ShutdownMessage;
  Subscription: SubscriptionMessage;
  Unsubscription: UnsubscriptionMessage;
  UserNotification: UserNotificationMessage;
};

export type SyncTopic = keyof SyncMessages;

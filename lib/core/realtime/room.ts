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

import { Channel } from "./channel";

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
 *
 * @property id
 * @property index
 * @property collection
 * @property connections
 * @property channels
 */
export class Room {
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
  private connections = new Set<string>();

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

  constructor(
    id: string,
    index: string,
    collection: string,
    channels?: Map<string, Channel>,
    connections?: Set<string>,
  ) {
    this.id = id;
    this.index = index;
    this.collection = collection;

    if (channels) {
      this.channels = channels;
    }

    if (connections) {
      this.connections = connections;
    }
  }

  /**
   * Number of connections subscribing to the room
   */
  get size(): number {
    return this.connections.size;
  }

  /**
   * Creates a new configuration channel on the room if it doesn't already exists
   */
  createChannel(channel: Channel): void {
    if (this.channels.has(channel.name)) {
      return;
    }

    this.channels.set(channel.name, channel);
  }

  addConnection(connectionId: string): void {
    this.connections.add(connectionId);
  }

  removeConnection(connectionId: string): void {
    this.connections.delete(connectionId);
  }
}

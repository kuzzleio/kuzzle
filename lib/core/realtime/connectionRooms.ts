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

import { JSONObject } from 'kuzzle-sdk';

/**
 * Each connection can subscribe to many rooms with different sets of volatile
 * data.
 *
 * This object is responsible to keep the association between each rooms and the
 * associated volatile data.
 *
 * @property rooms
 */
export class ConnectionRooms {
  /**
   * List of subscribed rooms and their associated volatile data
   *
   * Map<roomId, volatile>
   */
  private rooms = new Map<string, JSONObject>();

  constructor (rooms?: Map<string, JSONObject>) {
    if (rooms) {
      this.rooms = rooms;
    }
  }

  get roomIds (): string[] {
    return Array.from(this.rooms.keys());
  }

  get count (): number {
    return this.rooms.size;
  }

  addRoom (roomId: string, volatile: JSONObject) {
    this.rooms.set(roomId, volatile);
  }

  removeRoom (roomId: string) {
    this.rooms.delete(roomId);
  }

  hasRoom (roomId: string) {
    return this.rooms.has(roomId);
  }

  /**
   * Returns the volatile data for this room subscription
   */
  getVolatile (roomId: string) {
    return this.rooms.get(roomId);
  }
}
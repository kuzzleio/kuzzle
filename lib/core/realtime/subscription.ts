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

import { JSONObject } from "kuzzle-sdk";

/**
 * Represents a realtime subscription of a connection to a room.
 *
 * This object is used in the Internal Event System to give informations about
 * added/removed subscriptions.
 *
 * @property connectionId
 * @property roomId
 * @property index
 * @property collection
 * @property filters
 * @property kuid
 */
export class Subscription {
  public connectionId: string;
  public roomId: string;

  public index: string;
  public collection: string;
  public filters: JSONObject;

  public kuid: string;

  constructor(
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

    this.kuid = (user && user._id) || null;
  }
}

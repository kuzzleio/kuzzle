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
import { Connection, KuzzleRequest } from "../../api/request";
import * as kerror from "../../kerror";
import { ApplicationManager } from "./index";

const runtimeError = kerror.wrap("plugin", "runtime");

export class BackendSubscription extends ApplicationManager {
  /**
   * Registers a new realtime subscription on the specified connection
   *
   * @param connection Connection to register the subscription on
   * @param index Index name
   * @param collection Collection name
   * @param filters Subscription filters
   * @param options.volatile Volatile data
   * @param options.scope Subscription scope
   * @param options.users Option for users notifications
   */
  async add(
    connection: Connection,
    index: string,
    collection: string,
    filters: JSONObject,
    {
      volatile,
      scope,
      users,
    }: {
      volatile?: JSONObject;
      scope?: "in" | "out" | "all" | "none";
      users?: "in" | "out" | "all" | "none";
    } = {},
  ): Promise<{ roomId: string; channel: string }> {
    if (!this._application.started) {
      throw runtimeError.get("unavailable_before_start", "subscriptions.add");
    }

    const subscriptionRequest = new KuzzleRequest(
      {
        action: "subscribe",
        body: filters,
        collection,
        controller: "realtime",
        index,
        scope,
        users,
      },
      {
        connectionId: connection.id,
        volatile,
      },
    );

    const { channel, roomId } = await global.kuzzle.ask(
      "core:realtime:subscribe",
      subscriptionRequest,
    );

    return { channel, roomId };
  }

  async remove(connection: Connection, roomId: string): Promise<void> {
    if (!this._application.started) {
      throw runtimeError.get(
        "unavailable_before_start",
        "subscriptions.remove",
      );
    }

    await global.kuzzle.ask("core:realtime:unsubscribe", connection.id, roomId);
  }
}

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

import { JSONObject } from "../../../index";
import { EventHandler } from "../../types";

export class BackendCluster {
  /**
   * Broadcasts an event to listeners across all registered Kuzzle nodes
   *
   * @param  {string}        event
   * @param  {JSONObject}    payload
   * @return {Promise<void>}
   */
  async broadcast(event: string, payload: JSONObject): Promise<void> {
    await global.kuzzle.ask("cluster:event:broadcast", event, payload);
  }

  /**
   * Registers a listener to the provided event name.
   *
   * @param  {string}        event
   * @param  {EventHandler}      listener
   * @return {Promise<void>}       [description]
   */
  async on(event: string, listener: EventHandler): Promise<void> {
    await global.kuzzle.ask("cluster:event:on", event, listener);
  }

  /**
   * Registers a listener to the provided event name. This listener can be
   * invoked only once, after which it will be removed from the listeners list.
   *
   * @param  {string}        event
   * @param  {EventHandler}      listener
   * @return {Promise<void>}
   */
  async once(event: string, listener: EventHandler): Promise<void> {
    await global.kuzzle.ask("cluster:event:once", event, listener);
  }

  /**
   * Removes a listener from an event.
   * If multiple instances of the same listener are registered, only the first
   * one is removed.
   *
   * @param  {string}        event
   * @param  {EventHandler}      listener
   * @return {Promise<void>}
   */
  async off(event: string, listener: EventHandler): Promise<void> {
    await global.kuzzle.ask("cluster:event:off", event, listener);
  }

  /**
   * Removes all listeners from an event.
   *
   * @param  {string}        event
   * @return {Promise<void>}
   */
  async removeAllListeners(event: string): Promise<void> {
    await global.kuzzle.ask("cluster:event:removeAllListeners", event);
  }
}

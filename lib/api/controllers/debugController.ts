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

import { KuzzleRequest } from "../request";
import { NativeController } from "./baseController";
import * as kerror from "../../kerror";
import get from "lodash/get";

/**
 * @class DebugController
 */
export class DebugController extends NativeController {
  constructor() {
    super([
      "nodeVersion",
      "enable",
      "disable",
      "post",
      "addListener",
      "removeListener",
    ]);
  }

  /**
   * Return the node version of the current Kuzzle instance
   */
  async nodeVersion() {
    return process.version;
  }

  /**
   * Connect the debugger
   */
  async enable() {
    if (!get(global.kuzzle.config, "security.debug.native_debug_protocol")) {
      throw kerror.get(
        "core",
        "debugger",
        "native_debug_protocol_usage_denied",
      );
    }

    await global.kuzzle.ask("core:debugger:enable");
  }

  /**
   * Disconnect the debugger and clears all the events listeners
   */
  async disable() {
    if (!get(global.kuzzle.config, "security.debug.native_debug_protocol")) {
      throw kerror.get(
        "core",
        "debugger",
        "native_debug_protocol_usage_denied",
      );
    }

    await global.kuzzle.ask("core:debugger:disable");
  }

  /**
   * Trigger action from debugger directly following the Chrome Debug Protocol
   * See: https://chromedevtools.github.io/devtools-protocol/v8/
   */
  async post(request: KuzzleRequest) {
    if (!get(global.kuzzle.config, "security.debug.native_debug_protocol")) {
      throw kerror.get(
        "core",
        "debugger",
        "native_debug_protocol_usage_denied",
      );
    }

    const method = request.getBodyString("method");
    const params = request.getBodyObject("params", {});

    return global.kuzzle.ask("core:debugger:post", method, params);
  }

  /**
   * Make the websocket connection listen and receive events from Chrome Debug Protocol
   * See events from: https://chromedevtools.github.io/devtools-protocol/v8/
   */
  async addListener(request: KuzzleRequest) {
    if (!get(global.kuzzle.config, "security.debug.native_debug_protocol")) {
      throw kerror.get(
        "core",
        "debugger",
        "native_debug_protocol_usage_denied",
      );
    }

    if (request.context.connection.protocol !== "websocket") {
      throw kerror.get(
        "api",
        "assert",
        "unsupported_protocol",
        request.context.connection.protocol,
        "debug:addListener",
      );
    }

    const event = request.getBodyString("event");

    await global.kuzzle.ask(
      "core:debugger:addListener",
      event,
      request.context.connection.id,
    );
  }

  /**
   * Remove the websocket connection from the events' listeners
   */
  async removeListener(request: KuzzleRequest) {
    if (!get(global.kuzzle.config, "security.debug.native_debug_protocol")) {
      throw kerror.get(
        "core",
        "debugger",
        "native_debug_protocol_usage_denied",
      );
    }

    if (request.context.connection.protocol !== "websocket") {
      throw kerror.get(
        "api",
        "assert",
        "unsupported_protocol",
        request.context.connection.protocol,
        "debug:removeListener",
      );
    }

    const event = request.getBodyString("event");

    await global.kuzzle.ask(
      "core:debugger:removeListener",
      event,
      request.context.connection.id,
    );
  }
}

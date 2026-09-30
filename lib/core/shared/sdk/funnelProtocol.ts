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

import type { RequestPayload } from "kuzzle-sdk";
import { KuzzleEventEmitter } from "kuzzle-sdk";

import { Request } from "../../../api/request";
import type { User } from "../../../model/security/user";
import * as kerror from "../../../kerror";

export class FunnelProtocol extends KuzzleEventEmitter {
  private id = "funnel";
  private connectionId: string | null = null;

  constructor() {
    super();

    /**
     * Realtime notifications are sent by the InternalProtocol
     * through the internal event system.
     */
    global.kuzzle.on("core:network:internal:message", (message) => {
      // Send the notifications to the SDK for the internal Room mechanism
      this.emit(message.room, message);
    });
  }

  isReady() {
    return true;
  }

  /**
   *  Hydrate the user and execute SDK query
   */
  async query(request: RequestPayload) {
    // Through a local: the field is nullable and the narrowing an `if` on it
    // gives does not survive the `await` below.
    let connectionId = this.connectionId;

    if (connectionId === null) {
      // `ask` answers `any`; `InternalProtocol` registers this one as
      // `() => this.connection.id`, a string.
      const id: string = await global.kuzzle.ask(
        "core:network:internal:connectionId:get",
      );

      connectionId = id;
      this.connectionId = id;
    }

    // Annotated, because the initialiser alone infers `user: null` and every
    // read below is then a read off `never`.
    const requestOptions: {
      connection: { id: string; protocol: string };
      user: User | null;
    } = {
      connection: {
        id: connectionId,
        protocol: this.id,
      },
      user: null,
    };

    // Validate and use the provided request.kuid
    if (request.__kuid__) {
      if (typeof request.__kuid__ !== "string") {
        throw kerror.get("plugin", "context", "invalid_user");
      }
      // Get the user and store it in this context to prevent any possible race conditions
      requestOptions.user = await global.kuzzle.ask(
        "core:security:user:get",
        request.__kuid__,
      );
    }

    const kuzzleRequest = new Request(request, requestOptions);

    if (
      requestOptions.user &&
      request.__checkRights__ &&
      !(await requestOptions.user.isActionAllowed(kuzzleRequest))
    ) {
      throw kerror.get(
        "security",
        "rights",
        "forbidden",
        kuzzleRequest.input.controller,
        kuzzleRequest.input.action,
        requestOptions.user._id,
      );
    }

    const result =
      await global.kuzzle.funnel.executePluginRequest(kuzzleRequest);

    return { result };
  }
}

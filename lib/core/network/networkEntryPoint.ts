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

import { KuzzleRequest } from "../../api/request";
import { ServerConfiguration } from "../../types";
import type ClientConnection from "./clientConnection";

/**
 * The EntryPoint surface a protocol is allowed to reach.
 *
 * `entryPoint.js` is still JavaScript (it is converted by sprint 6's PR H6).
 * Declaring the contract here rather than inferring it from that file is not
 * only a stop-gap: the inference is actively wrong, because the JSDoc
 * `@param {Request}` resolves to the **DOM** `Request` — `lib.dom` is in
 * `tsconfig.json`'s `lib` and nothing imports Kuzzle's `Request` into scope.
 */
export interface NetworkEntryPoint {
  config: ServerConfiguration;

  execute(
    connection: ClientConnection,
    request: KuzzleRequest,
    cb: (response: JSONObject) => void,
  ): void;

  logAccess(
    connection: ClientConnection,
    request: KuzzleRequest,
    extra?: JSONObject | null,
  ): void;

  newConnection(connection: ClientConnection): void;

  removeConnection(connectionId: string): void;
}

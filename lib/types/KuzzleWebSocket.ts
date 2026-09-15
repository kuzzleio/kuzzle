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

import type { JSONObject } from "kuzzle-sdk";
import type uWS from "uWebSockets.js";

/**
 * What Kuzzle hands `res.upgrade()` as the socket's user data.
 *
 * uWebSockets merges it onto the socket object itself, which is why the code
 * reads `socket.internal` rather than `socket.getUserData().internal` — the
 * intersection below is what says so.
 */
export interface KuzzleSocketData {
  headers: JSONObject;
  internal: {
    debugSession?: boolean;
  };
  /** Rate-limiting bookkeeping, written on the socket by the WS protocol. */
  last?: number;
  count?: number;
}

/** A WebSocket carrying Kuzzle's own upgrade data. */
export type KuzzleWebSocket = uWS.WebSocket<unknown> & KuzzleSocketData;

/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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
 * Kuzzle authentication token.
 */
export interface Token extends JSONObject {
  /**
   * Unique ID
   */
  _id: string;

  /**
   * Expiration date in Epoch-micro
   */
  expiresAt: number;

  /**
   * Time-to-live
   */
  ttl: number;

  /**
   * Associated user ID
   */
  userId: string;

  /**
   * Associated connection ID
   */
  connectionId: string | null;

  /**
   * JWT token
   */
  jwt: string;

  /**
   * True if the token has been refreshed with the current request
   */
  refreshed: boolean;

  /**
   * Token type, could be authToken or apiKey
   */
  type: string;
}


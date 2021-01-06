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

import { JSONObject} from '../../index';

export type ResponseErrorPayload = {
  /**
   * Error human readable identifier
   */
  id: string;

  /**
   * Error identifier
   */
  code: number;

  /**
   * Error message
   */
  message: string;

  /**
   * HTTP status error code
   */
  status: number;

  /**
   * Error stacktrace (only if NODE_ENV=development)
   */
  stack?: string;
};

/**
 * Kuzzle API response payload
 *
 * @see https://docs.kuzzle.io/core/2/api/payloads/response
 */
export type ResponsePayload = {
  /**
   * API controller name
   */
  controller: string;

  /**
   * API action name
   */
  action: string;

  /**
   * Index name
   */
  index?: string;

  /**
   * Collection name
   */
  collection?: string;

  /**
   * Document unique identifier
   */
  _id?: string;

  /**
   * API error
   */
  error?: ResponseErrorPayload;

  /**
   * Request unique identifier
   */
  requestId: string;

  /**
   * API action result
   */
  result: any;

  /**
   * HTTP status code
   */
  status: number;

  /**
   * Volatile data
   */
  volatile?: JSONObject;

  /**
   * Room unique identifier
   */
  room?: string;
}

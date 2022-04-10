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

import { KuzzleError } from './kuzzleError';

export class PartialError extends KuzzleError {
  public errors: Array<KuzzleError>;
  public count: number;

  constructor (message, body, id, code) {
    if (code === undefined && typeof id === 'number') {
      code = id;
      id = body;
      body = [];
    }
    else if (body === undefined) {
      body = [];
    }

    super(message, 206, id, code);

    this.errors = body;
    this.count = body.length;
  }

  toJSON () {
    const serialized = super.toJSON();

    serialized.errors = this.errors;
    serialized.count = this.count;

    return serialized;
  }
}

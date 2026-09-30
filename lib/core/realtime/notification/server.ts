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

import "../../../types/Global";

/**
 * A notification issued by the server itself rather than by a request —
 * currently only "TokenExpired".
 */
class ServerNotification {
  public status = 200;
  public info = "This is an automated server notification";
  public message: string;
  public type: string;
  public node: string;

  constructor(type: string, message: string) {
    this.message = message;
    this.type = type;
    this.node = global.kuzzle.id;
  }
}

export = ServerNotification;

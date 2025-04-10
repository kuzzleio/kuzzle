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

import Kuzzle from "../../kuzzle/kuzzle";
import { Backend } from "./index";

export class ApplicationManager {
  protected _application: any;

  constructor(application: Backend) {
    Reflect.defineProperty(this, "_application", {
      value: application,
    });
  }

  protected get _kuzzle(): Kuzzle {
    return this._application._kuzzle;
  }
}

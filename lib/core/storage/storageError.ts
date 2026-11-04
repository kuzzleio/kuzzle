/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2026 Kuzzle
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

import { wrap } from "../../kerror";

/**
 * The errors a storage driver throws: Kuzzle's `services.storage.*` error
 * codes, with their documented class, status and message (ADR-0003 step 05).
 * An external driver uses them so that a client gets the same error whatever
 * the engine.
 *
 * @example
 * throw storageError.get("not_found", id, index, collection);
 * throw storageError.getFrom(engineError, "unexpected_error", engineError.message);
 */
export const storageError = wrap("services", "storage");

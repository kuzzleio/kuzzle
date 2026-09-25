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

/**
 * An object with any key and any value — a JSON document, a request body, a
 * payload.
 *
 * Kuzzle's own definition (ADR-0002 step 02), declared exactly as kuzzle-sdk
 * declares its `JSONObject`, so that a value of one is a value of the other,
 * both ways: a plugin mixing the two imports sees no difference.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the SDK's exact type, kept interchangeable
export type JSONObject = Record<PropertyKey, any>;

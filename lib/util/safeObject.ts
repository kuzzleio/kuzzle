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

// Simple utility functions for safe (and fast) object manipulations

export function has(o: unknown, prop: PropertyKey): boolean {
  return Object.hasOwn(o as object, prop);
}

export function get(o: unknown, prop: PropertyKey): unknown {
  if (has(o, prop)) {
    return (o as Record<PropertyKey, unknown>)[prop];
  }

  return undefined;
}

export function isPlainObject(o: unknown): o is Record<string, unknown> {
  return Object.prototype.toString.call(o) === "[object Object]";
}

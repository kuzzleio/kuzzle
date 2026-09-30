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
 * Enum for Kuzzle's state.
 *
 * A frozen object rather than a TypeScript `enum`: the JavaScript exported a
 * frozen one, and an `enum` emits an ordinary, mutable object.
 */
const kuzzleStateEnum = Object.freeze({
  NOT_ENOUGH_NODES: 4,
  RUNNING: 2,
  SHUTTING_DOWN: 3,
  STARTING: 1,
});

/**
 * The value and the type keep the same name, which is what lets `kuzzle.ts`
 * write both `kuzzleStateEnum.RUNNING` and `get state(): kuzzleStateEnum` —
 * the two spellings the JavaScript supported through a `@typedef`.
 *
 * Derived from the object rather than declared, so it cannot drift. It widens
 * to `number`, which is exactly what `@typedef {number} kuzzleStateEnum` said:
 * `Object.freeze` over a plain literal gives `Readonly<{ … : number }>`, not
 * literal types, so no call site has to change.
 */
type kuzzleStateEnum = (typeof kuzzleStateEnum)[keyof typeof kuzzleStateEnum];

export = kuzzleStateEnum;

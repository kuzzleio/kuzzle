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

interface PolicyRight {
  value?: string | boolean;
}

function isAllowed(right: PolicyRight | undefined | null): boolean {
  return Boolean(right && (right.value === "allowed" || right.value === true));
}

/**
 * Merge function for policies rights
 *
 * @param prev existing policies rights
 * @param cur new policies rights to merge
 *
 * @returns the merged policies rights
 */
function merge(prev: PolicyRight | undefined, cur: PolicyRight): PolicyRight {
  cur.value = isAllowed(cur) || isAllowed(prev) ? "allowed" : "denied";

  return cur;
}

export = { merge };

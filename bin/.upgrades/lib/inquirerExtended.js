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

'use strict';

// Returns an instance of "inquirer" extended with a "direct" function that
// returns the answer directly, instead of a key-value map of answers.
// Useful only because we often prompt questions one by one, with tasks in the
// middle, and this "direct" function helps reducing the clutter.

const
  assert = require('assert').strict,
  inquirer = require('inquirer'),
  _ = require('lodash');

inquirer.direct = async function direct (prompt) {
  assert(_.isPlainObject(prompt), 'Invalid argument: expected a non-empty object');
  assert(typeof prompt.name === 'undefined', 'Unexpected "name" argument: if you need to set a name, use inquirer.prompt');

  const p = _.cloneDeep(prompt);
  p.name = 'foo';

  const { foo } = await inquirer.prompt(p);

  return foo;
};

module.exports = inquirer;

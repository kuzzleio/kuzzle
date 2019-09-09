/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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

const
  assert = require('assert').strict,
  { Client } = require('@elastic/elasticsearch'),
  inquirer = require('../../.utils/inquirerExtended'),
  ColorOutput = require('../../.utils/colorOutput'),
  validator = require('validator'),
  _ = require('lodash');

let
  source = null,
  target = null,
  promise = null;

const cout = new ColorOutput();

async function getEsClient(config) {
  const currentConfiguration = _.get(config, 'services.db.client');

  assert(currentConfiguration, 'Missing Kuzzle configuration for Elasticsearch.');

  cout.notice('Current Elasticsearch configuration:');
  /* eslint-disable-next-line no-console */
  console.dir(currentConfiguration, {colors: true, depth: null});

  const answers = await inquirer.prompt([
    {
      type: 'list',
      message: 'For this migration, use this current instance as the data',
      name: 'current',
      choices: ['source', 'target', 'source and target'],
      default: 'source',
    },
    {
      type: 'input',
      message: ({ current }) => `Enter the URL for the ${current === 'source' ? 'target': 'source'} instance:`,
      name: 'url',
      when: ({ current }) => current !== 'source and target',
      default: '',
      validate: url => validator.isURL(url) || 'A valid URL must be provided'
    }
  ]);

  const
    current = new Client(currentConfiguration),
    next = answers.url ? new Client(answers.url) : current;

  if (answers.current === 'source') {
    source = current;
    target = next;
  }
  else {
    source = next;
    target = current;
  }

  return { source, target };
}

module.exports = async config => {
  if (promise === null) {
    promise = getEsClient(config);
  }

  return promise;
};

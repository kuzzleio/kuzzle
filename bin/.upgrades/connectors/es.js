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
  { formatWithOptions } = require('util'),
  { Client } = require('@elastic/elasticsearch'),
  validator = require('validator'),
  _ = require('lodash');

let
  source = null,
  target = null,
  promise = null;

async function getEsClient(context) {
  const currentConfiguration = _.get(context.config, 'services.storageEngine.client');

  if (!currentConfiguration) {
    context.log.error('Missing Kuzzle configuration for Elasticsearch.');
    context.log.error('Missing configuration value: services.storageEngine.client');
    context.log.error('Aborted.');
    process.exit(1);
  }

  context.log.notice('Current Elasticsearch configuration:');
  context.log.print(
    formatWithOptions({ colors: false, depth: null }, currentConfiguration));

  const answers = await context.inquire.prompt([
    {
      type: 'list',
      message: 'For this migration, use this current instance as the data',
      name: 'current',
      choices: ['source', 'target', 'source and target'],
      default: 'target',
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
    next = answers.url ? new Client({ node: answers.url }) : current;

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

module.exports = async context => {
  if (promise === null) {
    promise = getEsClient(context);
  }

  return promise;
};

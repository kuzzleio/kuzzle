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

const getRedisConnector = require('../../connectors/redis');

async function copyKey (source, target, key) {
  const
    dump = await source.dumpBuffer(key),
    ttl = Math.max(0, await source.pttl(key));

  // Breaking change from v1 to v2, due to how indexes are handled:
  // token keys are prefixed "repos/%kuzzle/token" in v1, and
  // "repos/kuzzle/token" in v2
  const newKey = key.replace('repos/%kuzzle/token', 'repos/kuzzle/token');

  await target.restore(newKey, ttl, dump, 'REPLACE');
}

async function getSourceKeys (source, pattern) {
  if (!source.nodes) {
    return await source.keys(pattern);
  }

  const keys = [];

  for (const node of source.nodes('master')) {
    keys.push(...await node.source.keys(pattern));
  }

  return keys;
}

async function copyDatabase (context, source, target, db) {
  await source.select(db);
  await target.select(db);

  await target.flushdb();

  const keys = await getSourceKeys(source, '*');

  for (const key of keys) {
    await copyKey(source, target, key);
  }

  context.log.ok(`Imported cache keys from database ${db}`);
}

async function inPlaceMigration (context, client) {
  context.log.notice(`
In-place migration detected: this script will make the changes necessary to
make the cache data compatible with Kuzzle v2.`);

  const
    choices = {
      copy: 'Copy to new keys (obsolete keys will be delete once expired)',
      move: 'Move keys (cannot be undone, cache won\'t work with Kuzzle v1 anymore)',
      abort: 'Abort'
    },
    action = await context.inquire.direct({
      type: 'list',
      message: 'Select how the database should be migrated:',
      choices: Object.values(choices),
      default: choices.copy
    });

  if (action === choices.abort) {
    context.log.error('Aborted by user.');
    process.exit(0);
  }

  const db = context.config.services.internalCache.database || 0;

  await client.select(db);

  const keys = await getSourceKeys(client, 'repos/*');

  for (const key of keys) {
    await copyKey(client, client, key);

    if (action === choices.move) {
      await client.del(key);
    }
  }
}

async function upgradeToTarget (context, source, target) {
  context.log.notice(`
This script will WIPE TARGET DATABASES from the target cache instance.
Then, it will COPY all data from the source cache instance, without altering it
in any way.`);

  const confirm = await context.inquire.direct({
    type: 'confirm',
    message: 'Continue?',
    default: true
  });

  if (!confirm) {
    context.log.error('Aborted by user.');
    process.exit(0);
  }

  for (const cachedb of ['internalCache', 'memoryStorage']) {
    const config = context.config.services[cachedb];

    await copyDatabase(context, source, target, config.database || 0);
  }
}

module.exports = async function upgradeCache (context) {
  const { source, target } = await getRedisConnector(context);

  try {
    if (source === target) {
      await inPlaceMigration(context, source);
    }
    else {
      await upgradeToTarget(context, source, target);
    }

    context.log.ok('Cache import complete.');
  }
  catch (e) {
    context.log.error(`Cache import failure: ${e.message}`);
    context.log.print(e.stack);
    context.log.error('Aborted.');
    process.exit(1);
  }
};

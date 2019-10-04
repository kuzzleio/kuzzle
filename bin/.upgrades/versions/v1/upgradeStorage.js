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

const getESConnector = require('../../connectors/es');

const
  INTERNAL_PREFIX = '%',
  PUBLIC_PREFIX = '&',
  NAME_SEPARATOR = '.';

function getNewIndexName (index, collection) {
  const prefix = index[0] === '%' ? '' : PUBLIC_PREFIX;

  return `${prefix}${index}${NAME_SEPARATOR}${collection}`;
}

async function moveData (source, target, index, collection, newIndex) {
  let page = await source.search({
    index,
    type: collection,
    body: { sort: [ '_doc' ] },
    scroll: '1m',
    size: 1000
  });

  const total = page.body.hits.total;
  let moved = 0;

  while (moved < total) {
    const bulk = [];

    for (let i = 0; i < page.body.hits.hits.length; i++) {
      const doc = page.body.hits.hits[i];

      if (doc._source._kuzzle_info) {
        delete doc._source._kuzzle_info.active;
        delete doc._source._kuzzle_info.deleteAt;
      }

      bulk.push({ index: { _index: newIndex, _id: doc._id } });
      bulk.push(doc._source);
    }

    await target.bulk({ body: bulk, _source: false });

    moved += page.body.hits.hits.length;

    if (moved < total) {
      page = await source.scroll({
        scroll_id: page.body._scroll_id,
        scroll: '1m'
      });
    }
  }
}

async function createNewIndex (source, target, index, collection, newIndex) {
  const
    mappingsResponse = await source.indices.getMapping({
      index,
      type: collection
    }),
    mappings = mappingsResponse.body[index].mappings[collection];

  // remove obsolete mapping properties
  if (mappings.properties && mappings.properties._kuzzle_info) {
    delete mappings.properties._kuzzle_info.active;
    delete mappings.properties._kuzzle_info.deleteAt;
  }

  const exists = await target.indices.exists({ index: newIndex });

  if (exists.body) {
    await target.indices.delete({ index:newIndex });
  }

  await target.indices.create({
    index: newIndex,
    body: {
      mappings: {
        properties: mappings.properties,
        dynamic: mappings.dynamic || false,
        _meta: mappings._meta
      }
    }
  });
}

async function upgrade (source, target, index, collection, newIndex) {
  await createNewIndex(source, target, index, collection, newIndex);
  await moveData(source, target, index, collection, newIndex);
}

async function upgradeInternalCollections (context, source, target) {
  const collections = [ 'validations', 'config', 'roles', 'users', 'profiles' ];

  for (const collection of collections) {
    const newIndex = getNewIndexName('%kuzzle', collection);

    await upgrade(source, target, '%kuzzle', collection, newIndex);
    context.log.ok(`... migrated internal data: ${collection}`);
  }
}

async function upgradePluginsStorage (context, source, target) {
  const
    { body } = await source.cat.indices({ format: 'json' }),
    indexes = body.map(b => b.index).filter(n => n.startsWith('%plugin:'));

  for (const index of indexes) {
    const
      plugin = index.split(':')[1],
      newIndexBase = `%plugin-${plugin}${NAME_SEPARATOR}`,
      mappings = await source.indices.getMapping({ index }),
      collections = Object.keys(mappings.body[index].mappings);

    for (const collection of collections) {
      const newIndex = newIndexBase + collection;
      await upgrade(source, target, index, collection, newIndex);

      context.log.ok(`... migrated plugin ${plugin}: ${collection}`);
    }
  }
}

async function upgradeDataStorage (context, source, target) {

}

module.exports = async function upgradeStorage (context) {
  const { source, target } = await getESConnector(context);

  context.log.notice('This script will now start *COPYING* the existing data to the target storage space.');
  context.log.notice('If the upgrade is interrupted, this script can be replayed any number of times.');
  context.log.notice('Existing data from the older version of Kuzzle will be unaffected, but if Kuzzle indexes already exist in the target storage space, they will be overwritten without notice.');

  const confirm = await context.inquire.direct({
    type: 'confirm',
    message: 'Continue?',
    default: true
  });

  if (!confirm) {
    context.log.error('Aborted by user.');
    process.exit(0);
  }

  try {
    await upgradeInternalCollections(context, source, target);
    await upgradePluginsStorage(context, source, target);
    await upgradeDataStorage(context, source, target);
  }
  catch (e) {
    context.log.error(`Storage upgrade failure: ${e.message}`);
    context.log.print(e.stack);
    context.log.error('Aborted.');
    process.exit(1);
  }
};

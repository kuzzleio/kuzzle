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
  _ = require('lodash'),
  getESConnector = require('../../connectors/es'),
  ProgressBar = require('../../lib/progressBar');

const
  INTERNAL_PREFIX = '%',
  PUBLIC_PREFIX = '&',
  NAME_SEPARATOR = '.';

function getNewIndexName (index, collection) {
  const prefix = index[0] === '%' ? '' : PUBLIC_PREFIX;

  return `${prefix}${index}${NAME_SEPARATOR}${collection}`;
}

async function moveData (context, index, collection, newIndex) {
  let page = await context.source.search({
    index,
    type: collection,
    body: { sort: [ '_doc' ] },
    scroll: '1m',
    size: 1000
  });

  const
    total = page.body.hits.total,
    progressBar = new ProgressBar(
      context,
      `Importing: ${index}/${collection}`,
      total);
  let moved = 0;

  while (moved < total) {
    const bulk = [];

    for (let i = 0; i < page.body.hits.hits.length; i++) {
      const doc = page.body.hits.hits[i];

      if (doc._source._kuzzle_info) {
        delete doc._source._kuzzle_info.active;
        delete doc._source._kuzzle_info.deletedAt;
      }

      bulk.push({ create: { _index: newIndex, _id: doc._id } });
      bulk.push(doc._source);
    }

    await context.target.bulk({ body: bulk, _source: false });

    moved += page.body.hits.hits.length;

    progressBar.update(moved);

    if (moved < total) {
      page = await context.source.scroll({
        scroll_id: page.body._scroll_id,
        scroll: '1m'
      });
    }
  }

  progressBar.destroy();
  return total;
}

async function upgradeMappings (context, index, collection, newIndex) {
  const
    mappingsResponse = await context.source.indices.getMapping({
      index,
      type: collection
    }),
    mappings = mappingsResponse.body[index].mappings[collection];

  // replace obsolete mapping properties
  if (mappings.properties && mappings.properties._kuzzle_info) {
    mappings.properties._kuzzle_info =
      context.config.services.storageEngine.commonMapping.properties._kuzzle_info;
  }

  await context.target.indices.putMapping({
    index: newIndex,
    body: {
      properties: mappings.properties,
      dynamic: mappings.dynamic || false,
      _meta: mappings._meta
    }
  });
}

async function createNewIndex (context, newIndex) {
  const exists = await context.target.indices.exists({ index: newIndex });

  if (exists.body) {
    await context.target.indices.delete({ index: newIndex });
  }

  await context.target.indices.create({ index: newIndex });
}

async function upgrade (context, index, collection, newIndex) {
  await createNewIndex(context, newIndex);
  await upgradeMappings(context, index, collection, newIndex);
  return await moveData(context, index, collection, newIndex);
}

async function upgradeInternalStorage (context) {
  const
    config = context.config.services.storageEngine.internalIndex,
    index = `${INTERNAL_PREFIX}${config.name}`,
    mapconfig = config.collections,
    collections = {
      validations: mapconfig.validations,
      config: mapconfig.config,
      roles: mapconfig.roles,
      users: null,
      profiles: mapconfig.profiles
    };

  for (const [collection, mappings] of Object.entries(collections)) {
    const newIndex = getNewIndexName(index, collection);
    let total;

    if (mappings) {
      await createNewIndex(context, newIndex);
      await context.target.indices.putMapping({
        index: newIndex,
        body: mappings
      });
      total = await moveData(context, index, collection, newIndex);
    }
    else {
      total = await upgrade(context, index, collection, newIndex);
    }

    context.log.ok(`... migrated internal data: ${collection} (${total} documents)`);
  }

  // bootstrap document
  await context.target.create({
    index: `${index}.config`,
    id: 'internalIndex.dataModelVersion',
    body: { version: '2.0.0' }
  });

  await context.target.create({
    index: `${index}.config`,
    id: `${config.name}.done`,
    body: { timestamp: Date.now() }
  });
}

async function upgradePluginsStorage (context) {
  const
    { body } = await context.source.cat.indices({ format: 'json' }),
    indexes = body.map(b => b.index).filter(n => n.startsWith('%plugin:'));

  for (const index of indexes) {
    const
      plugin = index.split(':')[1],
      newIndexBase = `%plugin-${plugin}${NAME_SEPARATOR}`,
      mappings = await context.source.indices.getMapping({ index }),
      collections = Object.keys(mappings.body[index].mappings);

    for (const collection of collections) {
      const newIndex = newIndexBase + collection;
      const total = await upgrade(context, index, collection, newIndex);

      context.log.ok(`... migrated storage for plugin ${plugin}: ${collection} (${total} documents)`);
    }
  }
}

async function upgradeAliases (context, upgraded) {
  const response = await context.source.indices.getAlias({
    index: Object.keys(upgraded)
  });

  const aliases = {};
  for (const [index, obj] of Object.entries(response.body)) {
    if (Object.keys(obj.aliases).length > 0) {
      for (const newIndex of upgraded[index].targets) {
        aliases[newIndex] = obj.aliases;
      }
    }
  }

  if (Object.keys(aliases).length === 0) {
    return;
  }

  context.log.notice(`
Index aliases detected. This script can import them to the new structure, but
due to the removal of native collections in Elasticsearch, future aliases will
be duplicated across all of an index upgraded collections.`);

  const choice = await context.inquire.direct({
    type: 'confirm',
    message: 'Upgrade aliases?',
    default: false
  });

  if (!choice) {
    return;
  }

  for (const [index, obj] of Object.entries(aliases)) {
    for (const [name, body] of Object.entries(obj)) {
      await context.target.indices.putAlias({ index, name, body });
      context.log.ok(`...... alias ${name} on index ${index} upgraded`);
    }
  }
}

async function upgradeDataStorage (context) {
  const
    { body } = await context.source.cat.indices({ format: 'json' }),
    upgraded = {};
  let indexes = body
    .map(b => b.index)
    .filter(n => !n.startsWith(INTERNAL_PREFIX));

  context.log.notice(`There are ${indexes.length} data indexes that can be upgraded`);
  const choices = {
    all: 'upgrade all indexes',
    askIndex: 'choose which indexes can be upgraded',
    askCollection: 'choose which collections can be upgraded',
    skip: 'skip all data index upgrades'
  };

  const action = await context.inquire.direct({
    type: 'list',
    message: 'You want to',
    choices: Object.values(choices),
    default: choices.all
  });

  if (action === choices.skip) {
    return;
  }

  if (action === choices.askIndex) {
    indexes = await context.inquire.direct({
      type: 'checkbox',
      message: 'Select the indexes to upgrade:',
      choices: indexes.map(i => ({ name: i, checked: true }))
    });
  }

  for (const index of indexes) {
    const
      mappings = await context.source.indices.getMapping({ index }),
      allCollections = Object.keys(mappings.body[index].mappings);
    let collections = allCollections;

    if (action === choices.askCollection) {
      context.log.notice(`Starting to upgrade the index ${index}`);
      collections = await context.inquire.direct({
        type: 'checkbox',
        message: 'Select the collections to upgrade:',
        choices: collections.map(c => ({ name: c, checked: true }))
      });
    }

    upgraded[index] = {
      canBeRemoved: collections.length === allCollections.length,
      targets: []
    };

    for (const collection of collections) {
      const
        newIndex = getNewIndexName(index, collection),
        total = await upgrade(context, index, collection, newIndex);

      upgraded[index].targets.push(newIndex);
      context.log.ok(`... migrated data index ${index}: ${collection} (${total} documents)`);
    }
  }

  await upgradeAliases(context, upgraded);

  return upgraded;
}

async function destroyPreviousStructure (context, upgraded) {
  // there is no point in destroying the previous structure if not performing
  // an in-place migration
  if (!context.inPlace) {
    return;
  }

  const
    { body } = await context.source.cat.indices({ format: 'json' }),
    plugins = body.map(b => b.index).filter(n => n.startsWith('%plugin:'));

  let indexes = [
    '%kuzzle',
    ...plugins,
    ...Object.keys(upgraded).filter(i => upgraded[i].canBeRemoved)
  ];


  context.log.notice('Since this is an in-place migration, the previous structure can be removed.');
  context.log.notice('(only data indexes with ALL their collections upgraded can be deleted)');

  const
    choices = {
      no: 'No - keep everything as is',
      internal: 'Remove only Kuzzle internal data',
      kuzzleAndPlugins: 'Remove Kuzzle internal data and plugins storages',
      everything: 'Yes - remove all upgraded structures'
    };

  const action = await context.inquire.direct({
    type: 'list',
    message: 'Destroy? (THIS CANNOT BE REVERTED)',
    default: choices[0],
    choices: Object.values(choices)
  });

  if (action === choices.no) {
    context.log.ok('Previous structure left intact.');
    return;
  }

  if (action === choices.kuzzleAndPlugins) {
    indexes = [ '%kuzzle', ...plugins ];
  }
  else if (action === choices.internal) {
    indexes = [ '%kuzzle' ];
  }

  await context.source.indices.delete({ index: indexes });
  context.log.ok('Previous structure destroyed.');
}

module.exports = async function upgradeStorage (context) {
  const storageContext = await getESConnector(context);

  context.log.notice(`
This script will now start *COPYING* the existing data to the target storage
space.
If the upgrade is interrupted, this script can be replayed any number of times.
Existing data from the older version of Kuzzle will be unaffected, but if
Kuzzle indexes already exist in the target storage space, they will be
overwritten without notice.`);

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
    await upgradeInternalStorage(storageContext);
    await upgradePluginsStorage(storageContext);
    const upgraded = await upgradeDataStorage(storageContext);

    storageContext.log.ok('Storage migration complete.');
    await destroyPreviousStructure(storageContext, upgraded);
  }
  catch (e) {
    storageContext.log.error(`Storage upgrade failure: ${e.message}`);

    const reason = _.get(e, 'meta.body.error.reason');
    if (reason) {
      storageContext.log.error(`Reason: ${reason}`);
    }

    storageContext.log.print(e.stack);
    storageContext.log.error('Aborted.');
    process.exit(1);
  }

};

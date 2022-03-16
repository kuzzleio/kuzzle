/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

const fs = require('fs');

const _ = require('lodash');

const getESConnector = require('../../connectors/es');
const ProgressBar = require('../../lib/progressBar');

const INTERNAL_PREFIX = '%';
const PUBLIC_PREFIX = '&';
const NAME_SEPARATOR = '.';

function transformProfile (profile) {
  if (!Array.isArray(profile.policies)) {
    return profile;
  }

  for (const policy of profile.policies.filter(p => p.restrictedTo)) {
    for (const restriction of policy.restrictedTo.filter(r => r.collections)) {
      restriction.collections =
        restriction.collections.map(c => c.toLowerCase());
    }
  }
  return profile;
}

function getNewIndexName (index, collection) {
  const prefix = index[0] === '%' ? '' : PUBLIC_PREFIX;

  return `${prefix}${index}${NAME_SEPARATOR}${collection}`.toLocaleLowerCase();
}

function fixIndexName (context, index, collection, newIndex) {
  const lowercased = newIndex.toLowerCase();

  if (lowercased !== newIndex) {
    // uppercase letters were already forbidden in index names
    context.log.warn(`Index "${index}": collection "${collection}" has been renamed to "${collection.toLowerCase()}"`);
  }

  return lowercased;
}

async function moveData (context, index, collection, newIndex, transform) {
  console.log(`\n---------------------------\nStart migrating data for collection "${collection}"`);
  const countSource = await context.source.count({
    index,
    type: collection,
  });

  console.log(`    Source has ${countSource.body.count} documents`);

  let page = await context.source.search({
    body: { sort: [ '_doc' ] },
    index,
    scroll: '1m',
    size: context.argv.storagePageSize,
    type: collection
  });

  const total = page.body.hits.total;
  const progressBar = new ProgressBar(
    context,
    `Importing: ${index}/${collection}`,
    total);
  let moved = 0;

  while (moved < total) {
    const bulk = [];

    for (let i = 0; i < page.body.hits.hits.length; i++) {
      if (collection === 'users' && i === 0) {
        continue;
      }
      const doc = page.body.hits.hits[i];

      if (doc._source._kuzzle_info) {
        delete doc._source._kuzzle_info.active;
        delete doc._source._kuzzle_info.deletedAt;
      }

      if (transform) {
        doc._source = transform(doc._source);
      }

      bulk.push({
        create: {
          _id: doc._id,
          _index: newIndex,
          _type: context._type
        }
      });
      bulk.push(doc._source);
    }

    await context.target.bulk({ _source: false, body: bulk });

    moved += page.body.hits.hits.length;

    progressBar.update(moved);

    if (moved < total) {
      page = await context.source.scroll({
        scroll: '1m',
        scroll_id: page.body._scroll_id
      });
    }
  }

  progressBar.destroy();

  await context.target.indices.refresh({
    index: newIndex,
  });
  const countTarget = await context.target.count({
    index: newIndex,
  });

  console.log(`    Target has ${countTarget.body.count} documents`);

  if (countSource.body.count !== countTarget.body.count) {
    console.log(`${countSource.body.count - countTarget.body.count} documents missing, analyzing..`);
    await analyzeMissingDocuments(context, index, collection, newIndex);
  }

  return total;
}

async function analyzeMissingDocuments (context, index, collection, newIndex) {
  let page = await context.source.search({
    body: { sort: [ '_doc' ] },
    index,
    scroll: '1m',
    size: context.argv.storagePageSize,
    type: collection
  });

  console.log(`Missing documents IDs for "${collection}" is written at "./missing-${collection}.json"`)
  const analyzeReport = fs.createWriteStream(`./missing-${collection}.json`);

  let streamPromise = new Promise(resolve => {
    analyzeReport.on('finish', () => {
      resolve();
    });
  });

  analyzeReport.write('[\n');

  const total = page.body.hits.total;
  let analyzed = 0;
  const progressBar = new ProgressBar(
    context,
    `Analyzing: ${index}/${collection}`,
    total);

  while (analyzed < total) {
    const mGetRequest = {
      body: {
        docs: page.body.hits.hits.map(doc => ({
          _id: doc._id,
          _index: newIndex,
        }))
      }
    };

    const mGetResponse = await context.target.mget(mGetRequest);

    for (const doc of mGetResponse.body.docs) {
      if (! doc.found) {
        analyzeReport.write(`  "${doc._id}",\n`);
      }
    }

    // continue scroll
    analyzed += page.body.hits.hits.length;

    progressBar.update(analyzed);

    if (analyzed < total) {
      page = await context.source.scroll({
        scroll: '1m',
        scroll_id: page.body._scroll_id
      });
    }
  }

  analyzeReport.write(']');
  analyzeReport.end();
  await streamPromise;
  progressBar.destroy();
}

async function upgradeMappings (context, index, collection, newIndex) {
  const mappingsResponse = await context.source.indices.getMapping({
    index,
    type: collection
  });
  const mappings = mappingsResponse.body[index].mappings[collection];

  // replace obsolete mapping properties
  if (mappings.properties && mappings.properties._kuzzle_info) {
    mappings.properties._kuzzle_info =
      context.config.services.storageEngine.commonMapping.properties._kuzzle_info;
  }

  await context.target.indices.putMapping({
    body: {
      _meta: mappings._meta,
      dynamic: mappings.dynamic || false,
      properties: mappings.properties
    },
    index: newIndex,
    type: context._type,
  });
}

async function createNewIndex (context, previousIndex, newIndex) {
  const exists = await context.target.indices.exists({ index: newIndex });

  if (exists.body) {
    await context.target.indices.delete({ index: newIndex });
  }

  const settingsResponse = await context.source.indices.getSettings({
    index: previousIndex,
  });
  const previousSettings = settingsResponse.body[previousIndex].settings.index;

  const settings = {
    analysis: previousSettings.analysis,
  };

  await context.target.indices.create({ index: newIndex, body: { settings } });
}

async function upgrade (context, index, collection, newIndex) {
  const fixedIndexName = fixIndexName(context, index, collection, newIndex);

  await createNewIndex(context, index, fixedIndexName);
  await upgradeMappings(context, index, collection, fixedIndexName);

  return await moveData(context, index, collection, fixedIndexName);
}

async function upgradeInternalStorage (context) {
  const config = context.config.services.storageEngine.internalIndex;
  const index = `${INTERNAL_PREFIX}${config.name}`;
  const mapconfig = config.collections;
  const collections = {
    config: mapconfig.config,
    profiles: mapconfig.profiles,
    roles: mapconfig.roles,
    users: null,
    validations: mapconfig.validations,
  };

  for (const [collection, mappings] of Object.entries(collections)) {
    const newIndex = getNewIndexName(index, collection);
    let total;

    if (mappings) {
      await createNewIndex(context, index, newIndex);
      await context.target.indices.putMapping({
        body: mappings,
        index: newIndex,
        type: context._type
      });

      total = await moveData(
        context,
        index,
        collection,
        newIndex,
        collection === 'profiles' && transformProfile);
    }
    else {
      total = await upgrade(context, index, collection, newIndex);
    }

    context.log.ok(`... migrated internal data: ${collection} (${total} documents)`);
  }

  // bootstrap document
  await context.target.create({
    body: { version: '2.0.0' },
    id: 'internalIndex.dataModelVersion',
    index: `${index}.config`,
    type: context._type,
  });

  await context.target.create({
    body: { timestamp: Date.now() },
    id: `${config.name}.done`,
    index: `${index}.config`,
    type: context._type,
  });
}

async function upgradePluginsStorage (context) {
  const { body } = await context.source.cat.indices({ format: 'json' });
  const indexes = body.map(b => b.index).filter(n => n.startsWith('%plugin:'));

  for (const index of indexes) {
    const plugin = index.split(':')[1];
    const newIndexBase = `%plugin-${plugin}${NAME_SEPARATOR}`;
    const mappings = await context.source.indices.getMapping({ index });
    const collections = Object.keys(mappings.body[index].mappings);

    for (const collection of collections) {
      const newIndex = newIndexBase + collection;
      const total = await upgrade(context, index, collection, newIndex);

      context.log.ok(`... migrated storage for plugin ${plugin}: ${collection} (${total} documents)`);
    }
  }
}

async function upgradeAliases (context, upgraded) {
  const response = await context.source.indices.getAlias({
    index: Object.keys(upgraded),
  });

  const aliases = {};
  for (const [index, obj] of Object.entries(response.body)) {
    if (Object.keys(obj.aliases).length === 0) {
      continue;
    }

    const aliasName = Object.keys(obj.aliases)[0];

    for (let i = 0; i < upgraded[index].targets.length; i++) {
      const indice = upgraded[index].targets[i];
      const collection = upgraded[index].collections[i];

      aliases[indice] = {
        [`@&${aliasName}.${collection}`]: '',
        [`@&${index}.${collection}`]: '',
      };
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
    default: false,
    message: 'Upgrade aliases?',
    type: 'confirm'
  });

  if (!choice) {
    return;
  }

  for (const [index, obj] of Object.entries(aliases)) {
    for (const [name, body] of Object.entries(obj)) {
      await context.target.indices.putAlias({
        _type: context._type,
        body,
        index,
        name,
      });
      context.log.ok(`...... alias ${name} on index ${index} upgraded`);
    }
  }
}

async function upgradeDataStorage (context) {
  const { body } = await context.source.cat.indices({ format: 'json' });
  const upgraded = {};
  let indexes = body
    .map(b => b.index)
    .filter(n => !n.startsWith(INTERNAL_PREFIX));

  context.log.notice(`There are ${indexes.length} data indexes that can be upgraded`);
  const choices = {
    all: 'upgrade all indexes',
    askCollection: 'choose which collections can be upgraded',
    askIndex: 'choose which indexes can be upgraded',
    skip: 'skip all data index upgrades'
  };

  const action = await context.inquire.direct({
    choices: Object.values(choices),
    default: choices.all,
    message: 'You want to',
    type: 'list'
  });

  if (action === choices.skip) {
    return;
  }

  if (action === choices.askIndex) {
    indexes = await context.inquire.direct({
      choices: indexes.map(i => ({ checked: true, name: i })),
      message: 'Select the indexes to upgrade:',
      type: 'checkbox'
    });
  }

  for (const index of indexes) {
    const mappings = await context.source.indices.getMapping({ index });
    const allCollections = Object.keys(mappings.body[index].mappings);
    let collections = allCollections;

    if (action === choices.askCollection) {
      context.log.notice(`Starting to upgrade the index ${index}`);
      collections = await context.inquire.direct({
        choices: collections.map(c => ({ checked: true, name: c })),
        message: 'Select the collections to upgrade:',
        type: 'checkbox'
      });
    }

    upgraded[index] = {
      canBeRemoved: collections.length === allCollections.length,
      targets: [],
      collections: [],
    };

    for (const collection of collections) {
      const newIndex = getNewIndexName(index, collection);
      const total = await upgrade(context, index, collection, newIndex);

      upgraded[index].targets.push(newIndex);
      upgraded[index].collections.push(collection.toLocaleLowerCase());
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

  const { body } = await context.source.cat.indices({ format: 'json' });
  const plugins = body.map(b => b.index).filter(n => n.startsWith('%plugin:'));

  let indexes = [
    '%kuzzle',
    ...plugins,
    ...Object.keys(upgraded).filter(i => upgraded[i].canBeRemoved),
  ];


  context.log.notice('Since this is an in-place migration, the previous structure can be removed.');
  context.log.notice('(only data indexes with ALL their collections upgraded can be deleted)');

  const choices = {
    everything: 'Yes - remove all upgraded structures',
    internal: 'Remove only Kuzzle internal data',
    kuzzleAndPlugins: 'Remove Kuzzle internal data and plugins storages',
    no: 'No - keep everything as is'
  };

  const action = await context.inquire.direct({
    choices: Object.values(choices),
    default: choices[0],
    message: 'Destroy? (THIS CANNOT BE REVERTED)',
    type: 'list'
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
  const targetInfo = await storageContext.target.info();
  const targetMajor = targetInfo.body.version.number.split('.')[0];

  storageContext._type = storageContext.inPlace && targetMajor === '5'
    ? 'default'
    : undefined;

  context.log.notice(`
This script will now start *COPYING* the existing data to the target storage
space.
If the upgrade is interrupted, this script can be replayed any number of times.
Existing data from the older version of Kuzzle will be unaffected, but if
Kuzzle indexes already exist in the target storage space, they will be
overwritten without notice.`);

  // const confirm = await context.inquire.direct({
  //   default: true,
  //   message: 'Continue?',
  //   type: 'confirm'
  // });

  // if (!confirm) {
  //   context.log.error('Aborted by user.');
  //   process.exit(0);
  // }

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

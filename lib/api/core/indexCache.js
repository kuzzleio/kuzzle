/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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

const
  _ = require('lodash'),
  Bluebird = require('bluebird');

/**
 * Index/collection cache management
 */
class IndexCache {

  constructor (kuzzle) {
    this.indexes = {};
    this.defaultMappings = {};

    this.kuzzle = kuzzle;
    this.commonMapping = this.kuzzle.config.services.db.commonMapping;
  }

  initInternal (internalEngine) {
    return internalEngine.getMapping()
      .then(mapping => {
        for (const index of Object.keys(mapping)) {
          this.indexes[index] = Object.keys(mapping[index].mappings);
        }
      });
  }

  init () {
    const engine = this.kuzzle.internalEngine;
    const kuzzleInfoFieldsRegex = new RegExp(`^_kuzzle_info\\.(${Object.keys(this.commonMapping._kuzzle_info.properties).join('|')})$`);

    return engine.listIndexes()
      .then(indexes => {
        const promises = [];

        for (const index of indexes) {
          if (index === this.kuzzle.internalEngine.index) {
            continue;
          }

          this.indexes[index] = [];
          this.defaultMappings[index] = _.cloneDeep(this.commonMapping);

          promises.push(engine.getFieldMapping({
            index,
            fields: '_kuzzle_info.*'
          })
            .then(kuzInfoMappings => {
              if (kuzInfoMappings[index] && kuzInfoMappings[index].mappings) {
                for (const collection of Object.keys(kuzInfoMappings[index].mappings)) {
                  const collectionInfo = kuzInfoMappings[index].mappings[collection];

                  for (const dotField of Object.keys(collectionInfo).filter(f => kuzzleInfoFieldsRegex.test(f))) {
                    Object.assign(this.defaultMappings[index]._kuzzle_info.properties, collectionInfo[dotField].mapping);
                  }
                  // do not break to catch cases where not all fields are defined
                }
              }

              return engine.listCollections(index);
            })
            .then(collections => {
              const updateMappingPromises = [];

              this.indexes[index] = collections;

              for (const collection of collections) {
                updateMappingPromises.push(engine.updateMapping(collection, {
                  properties: this.defaultMappings[index]
                }, index));
              }

              return Bluebird.all(updateMappingPromises);
            })
          );
        }

        return Bluebird.all(promises);
      });
  }

  add (index, collection, notify = true) {
    let modified = false;

    if (index !== undefined) {
      if (!this.indexes[index]) {
        this.indexes[index] = [];
        modified = true;
      }

      if (collection && this.indexes[index].indexOf(collection) === -1) {
        this.indexes[index].push(collection);
        modified = true;
      }
    }

    if (notify && modified) {
      this.kuzzle.pluginsManager.trigger('core:indexCache:add', {index, collection});
    }

    return modified;
  }

  exists (index, collection) {
    if (collection === undefined) {
      return this.indexes[index];
    }

    return this.indexes[index] && this.indexes[index].indexOf(collection) !== -1;
  }

  remove (index, collection, notify = true) {
    let
      modified = false;

    if (index && this.indexes[index]) {
      if (collection) {
        const position = this.indexes[index].indexOf(collection);

        if (position >= 0) {
          this.indexes[index].splice(position, 1);
          modified = true;
        }
      }
      else {
        delete this.indexes[index];
        modified = true;
      }
    }

    if (notify && modified) {
      this.kuzzle.pluginsManager.trigger('core:indexCache:remove', {index, collection});
    }

    return modified;
  }

  reset (index, notify = true) {
    if (index !== undefined) {
      this.indexes[index] = [];
    }
    else {
      this.indexes = {};
    }

    if (notify) {
      this.kuzzle.pluginsManager.trigger('core:indexCache:reset', {index});
    }
  }
}

module.exports = IndexCache;

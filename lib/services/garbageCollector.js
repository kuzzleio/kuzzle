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
  Bluebird = require('bluebird'),
  Request = require('kuzzle-common-objects').Request;

// Time constants
const 
  oneHour = 3600000,
  oneDay = oneHour * 24;

// There can be only one
let _highlander = null;

class GarbageCollector {
  constructor(kuzzle) {
    this.kuzzle = kuzzle;
  }

  init () {
    // We do not want to trigger the garbage collector right away:
    // if for whatever reason Kuzzle is (re)started on a production
    // environment (after a crash, because of autoscaling, etc),
    // the last thing a client needs is to clean up trashcans
    setTimeout(() => this.run(), this.kuzzle.config.services.garbageCollector.cleanInterval || oneDay);

    return Bluebird.resolve(this);
  }

  run () {
    let ids = [];

    if (this.kuzzle.funnel.overloaded) {
      // Reschedule the task to be run in 1 hour
      setTimeout(() => this.run(), oneHour);

      return Bluebird.resolve();
    }

    return this.kuzzle.pluginsManager.trigger('gc:start')
      .then(() => {
        this.kuzzle.pluginsManager.trigger('log:info', '[GC] Started');

        // Builds an array of {index, collection} pairs
        const indexes = Object.keys(this.kuzzle.indexCache.indexes)
          .filter(index => index[0] !== '%'); // skipping reserved indexes

        let collections = [];

        for (const index of indexes) {
          collections = collections.concat(this.kuzzle.indexCache.indexes[index].map(collection => ({index, collection})));
        }

        return Bluebird.resolve(collections)
          .each(icpair => {
            return this.clearCollection(icpair.index, icpair.collection)
              .then(deletedIds => {
                if (deletedIds.length) {
                  // using concat instead of push + spread operator because the list
                  // of deleted IDs may be large
                  ids = ids.concat(deletedIds);
                  this.kuzzle.pluginsManager.trigger('log:info', `[GC] ${icpair.index}/${icpair.collection}: trashcan emptied (${deletedIds.length} documents deleted)`);
                }

                return null;
              });
          });
      })
      .then(() => {
        if (ids.length) {
          this.kuzzle.pluginsManager.trigger('log:info', `[GC] Finished: ${ids.length} documents deleted in all trashcans`);
        }

        this.kuzzle.pluginsManager.trigger('gc:end', {ids});
        return {ids};
      })
      .catch(error => {
        this.kuzzle.pluginsManager.trigger('log:error', error);
        return null;
      })
      .finally(() => {
        // Reschedule the task to be executed every 24 hours by default
        setTimeout(
          () => this.run(), 
          this.kuzzle.config.services.garbageCollector.cleanInterval || oneDay
        );
      });
  }

  clearCollection(index, collection) {
    if (this.kuzzle.funnel.overloaded) {
      // skip
      return Bluebird.resolve([]);
    }

    const body = {
      from: 0,
      size: this.kuzzle.config.services.garbageCollector.maxDelete || 10000,
      sort: [{ '_kuzzle_info.deletedAt': { unmapped_type: 'date'} }],
      query: {
        bool: {
          should: [
            {
              term: {
                '_kuzzle_info.active': false
              }
            }
          ]
        }
      }
    };

    const request = new Request({index, collection, body});

    return this.kuzzle.services.list.storageEngine.deleteByQueryFromTrash(request)
      .then(deletedDocs => deletedDocs.ids)
      .catch(error => {
        this.kuzzle.pluginsManager.trigger('log:error', error);
        // always resolve the promise, we don't want to break the GC when an error occurs
        return [];
      });
  }
}

module.exports = function singleton (kuzzle) {
  _highlander = _highlander || new GarbageCollector(kuzzle);
  return _highlander;
};

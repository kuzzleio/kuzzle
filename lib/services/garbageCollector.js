'use strict';

const
  OneHour = 3600000,
  OneDay = OneHour * 24,
  Promise = require('bluebird'),
  Request = require('kuzzle-common-objects').Request

function GarbageCollector(kuzzle) {
  this.timer = null;

  this.init = function garbageCollectorInit() {
    this.run();
    return Promise.resolve(this);
  };

  this.run = function garbageCollectorRun () {
    let
      ids = [],
      body = {
      from: 0,
        size: kuzzle.config.services.garbageCollector.maxDelete || 10000,
        sort: ['_kuzzle_info.deletedAt'],
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

    if (this.timer) {
      clearTimeout(this.timer);
    }

    if (kuzzle.funnel.overloaded) {
      // Reschedule the task to run in 1 hour
      this.timer = setTimeout(this.run, OneHour);

      return Promise.resolve({ids});
    }

    // Reschedule the task to be executed every 24 hours by default
    this.timer = setTimeout(this.run, kuzzle.config.services.garbageCollector.cleanInterval || OneDay);

    return kuzzle.pluginsManager.trigger('gc:start')
      .then(() => {
        kuzzle.pluginsManager.trigger('log:info', '[GC] Started');

        return kuzzle.services.list.storageEngine.listIndexes()
          .then(res => {
            let indexesPromises = [];

            res.indexes.forEach(index => {
              if (index === kuzzle.internalEngine.index) {
                return;
              }

              indexesPromises.push(
                kuzzle.services.list.storageEngine.listCollections(new Request({index}))
                  .then(collections => {
                    let collectionsPromises = [];

                    collections.collections.stored.forEach(collection => {
                      let request = new Request({index, collection, body});

                      collectionsPromises.push(
                        kuzzle.services.list.storageEngine.deleteByQueryFromTrash(request)
                          .then(deletedDocs => {

                            ids = ids.concat(deletedDocs.ids);

                            kuzzle.pluginsManager.trigger('log:info', `[GC] Deleted ${deletedDocs.ids.length} documents on collection ${collection} of index ${index}`);
                            return null;
                          })
                          .catch(deleteByQueryFromTrashError => {
                            kuzzle.pluginsManager.trigger('log:error', deleteByQueryFromTrashError);
                            return null;
                          })
                          .finally(() => {
                            // always resolve the promise, we don't want to break the GC when an error occurs
                            return Promise.resolve();
                          })
                      );
                    });

                    return Promise.all(collectionsPromises);
                  })
                  .catch(listCollectionsError => {
                    kuzzle.pluginsManager.trigger('log:error', listCollectionsError);
                    return null;
                  })
                  .finally(() => {
                    // always resolve the promise, we don't want to break the GC when an error occurs
                    return Promise.resolve();
                  })
              );
            });

            return Promise.all(indexesPromises);
          })
          .then(() => {
            kuzzle.pluginsManager.trigger('log:info', `[GC] Finished. Deleted ${ids.length} documents`);
            kuzzle.pluginsManager.trigger('gc:end', {ids});

            return {ids};
          })
          .catch(listIndexesError => {
            kuzzle.pluginsManager.trigger('log:error', listIndexesError);
            return null;
          });
      })
      .catch(pipeError => {
        kuzzle.pluginsManager.trigger('log:error', pipeError);
        return null;
      });
  };
}
module.exports = GarbageCollector;
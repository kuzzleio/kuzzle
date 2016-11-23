'use strict';

const
  OneHour = 3600000,
  OneDay = OneHour * 24,
  Promise = require('bluebird'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject;

function GarbageCollector(kuzzle) {
  this.init = function garbageCollectorInit() {
    this.run();
    return Promise.resolve(this);
  };

  this.run = function garbageCollectorSchedule () {
    if (!kuzzle.funnel.overloaded) {
      let deleteByQueryFromTrashRequest = new RequestObject({
        index: null,
        collection: null,
        body: {
          from: 0,
          size: kuzzle.config.services.garbageCollector.maxDelete,
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
        }
      });

      kuzzle.pluginsManager.trigger('gc:start')
        .then(() => {
          kuzzle.pluginsManager.trigger('log:info', '███ Running garbage collector.');

          kuzzle.services.list.storageEngine.listIndexes()
            .then(res => {
              res.indexes.forEach(index => {
                if (index === kuzzle.internalEngine.index) {
                  return;
                }

                kuzzle.services.list.storageEngine.listCollections(new RequestObject({index}))
                  .then(collections => {
                    collections.collections.stored.forEach(collection => {

                      deleteByQueryFromTrashRequest.index = index;
                      deleteByQueryFromTrashRequest.collection = collection;

                      kuzzle.services.list.storageEngine.deleteByQueryFromTrash(deleteByQueryFromTrashRequest)
                        .then((deletedDocs) => {
                          kuzzle.pluginsManager.trigger('log:info', '███ Garbage collector deleted ' + deletedDocs.ids.length + ' document' + deletedDocs.ids.length > 1 ? 's.' : '.');
                          
                          return kuzzle.pluginsManager.trigger('gc:end', {total: deletedDocs.ids.length, ids: deletedDocs.ids});
                        })
                        .catch(deleteByQueryFromTrashError => {
                          kuzzle.pluginsManager.trigger('log:error', deleteByQueryFromTrashError);
                        });
                    });
                  })
                  .catch(listCollectionsError => {
                    kuzzle.pluginsManager.trigger('log:error', listCollectionsError);
                  });
              });
            })
            .catch(listIndexesError => {
              kuzzle.pluginsManager.trigger('log:error', listIndexesError);
            });

          return null;
        })
        .catch(pipeError => {
          kuzzle.pluginsManager.trigger('log:error', pipeError);
        });

      // Schedule the task to be executed every 24 hours by default
      setTimeout(() => this.run(), kuzzle.config.services.garbageCollector.cleanInterval || OneDay);
    } else {
      // Reschedule the task to run in 1 hour
      setTimeout(() => this.run(), OneHour);
    }
  };
}
module.exports = GarbageCollector;
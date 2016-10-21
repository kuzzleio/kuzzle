var Promise = require('bluebird');
var RequestObject = require('kuzzle-common-objects').Models.requestObject;

function GarbageCollector(kuzzle) {

  this.init = function garbageCollectorInit() {
    this.schedule();
    return Promise.resolve(this);
  };

  this.schedule = function garbageCollectorSchedule () {
    // Schedule the task to be executed every 24 hours by default
    setTimeout(() => {
      if (!kuzzle.funnel.overloaded) {
        kuzzle.services.list.storageEngine.listIndexes()
          .then(res => {
            res.indexes.forEach(index => {
              if (index !== '%kuzzle') {
                kuzzle.services.list.storageEngine.listCollections(new RequestObject({index}))
                  .then(col => {
                    col.collections.stored.forEach(collection => {
                      kuzzle.services.list.storageEngine.deleteByQueryFromTrash(new RequestObject({
                        index,
                        collection,
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
                      }))
                        .then((deletedDocs) => {
                          kuzzle.pluginsManager.trigger('log:info', '███ Garbage collector deleted ' + deletedDocs.ids.length + ' document' + deletedDocs.ids.length > 1 ? 's.' : '.');
                        })
                        .catch(deleteByQueryFromTrashError => {
                          kuzzle.pluginsManager.trigger('log:error', deleteByQueryFromTrashError);
                        });
                    });
                  })
                  .catch(listCollectionsError => {
                    kuzzle.pluginsManager.trigger('log:error', listCollectionsError);
                  });
              }
            });
          })
          .catch(listIndexesError => {
            kuzzle.pluginsManager.trigger('log:error', listIndexesError);
          });
        this.schedule();
      } else {
        // Reschedule the task to run in 1 hour
        setTimeout(() => {
          this.schedule();
        }, 3600000);
      }
    }, kuzzle.config.services.garbageCollector.cleanInterval || 86400000);
  };
}
module.exports = GarbageCollector;
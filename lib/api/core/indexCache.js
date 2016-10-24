var
  RequestObject = require('kuzzle-common-objects').Models.requestObject;

/**
 * Index/collection cache management
 */
module.exports = function indexCache (kuzzle) {
  this.indexes = {};

  this.initInternal = function indexCacheInitInternal () {
    return kuzzle.internalEngine.getMapping()
      .then(mapping => {
        Object.keys(mapping).forEach(index => {
          this.indexes[index] = Object.keys(mapping[index].mappings);
        });
      });
  };


  this.init = function () {
    return kuzzle.services.list.storageEngine.listIndexes(new RequestObject({}))
      .then(result => {
        result.indexes.forEach(index => {
          this.indexes[index] = [];

          kuzzle.services.list.storageEngine.listCollections(new RequestObject({index: index}))
            .then(resultCollections => {
              this.indexes[index] = resultCollections.collections.stored;
            });
        });
      });
  };

  this.add = function indexCacheAdd (index, collection, notify) {
    var modified = false;

    notify = (notify === undefined) || notify;

    if (index !== undefined) {
      if (!this.indexes[index]) {
        this.indexes[index] = [];
        modified = true;
      }

      if (collection) {
        if (this.indexes[index].indexOf(collection) === -1) {
          this.indexes[index].push(collection);
          modified = true;
        }
      }
    }

    if (notify && modified) {
      kuzzle.pluginsManager.trigger('core:indexCache:add', {index, collection});
    }
    
    return modified;
  };

  this.exists = function indexCacheExists (index, collection) {
    if (collection === undefined) {
      return this.indexes[index];
    }

    return this.indexes[index] && this.indexes[index].indexOf(collection) !== -1;
  };

  this.remove = function indexCacheRemove (index, collection, notify) {
    var 
      modified = false,
      position;
    
    notify = (notify === undefined) || notify;

    if (index && this.indexes[index]) {
      if (collection) {
        position = this.indexes[index].indexOf(collection);

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
      kuzzle.pluginsManager.trigger('core:indexCache:remove', {index, collection});
    }
    
    return modified;
  };

  this.reset = function indexCacheReset (index, notify) {
    notify = (notify === undefined) || notify;
    
    if (index !== undefined) {
      this.indexes[index] = [];
    }
    else {
      this.indexes = {};
    }
    
    if (notify) {
      kuzzle.pluginsManager.trigger('core:indexCache:reset', {index});
    }
  };
};



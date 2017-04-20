'use strict';

/**
 * Index/collection cache management
 */
class IndexCache {

  constructor (kuzzle) {
    this.indexes = {};
    this.kuzzle = kuzzle;
  }

  initInternal (internalEngine) {
    return internalEngine.getMapping()
      .then(mapping => {
        Object.keys(mapping).forEach(index => {
          this.indexes[index] = Object.keys(mapping[index].mappings);
        });
      });
  }

  init () {
    return this.kuzzle.internalEngine.listIndexes()
      .then(indexes => {
        indexes.forEach(index => {
          this.indexes[index] = [];

          this.kuzzle.internalEngine.listCollections(index)
            .then(collections => {
              this.indexes[index] = collections;
            });
        });
      });
  }

  add (index, collection, notify) {
    let modified = false;

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

  remove (index, collection, notify) {
    let
      modified = false;

    notify = (notify === undefined) || notify;

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

  reset (index, notify) {
    notify = (notify === undefined) || notify;

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

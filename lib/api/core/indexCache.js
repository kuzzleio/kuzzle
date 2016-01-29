var
  RequestObject = require('./models/requestObject');

/**
 * Index/collection cache management
 */
module.exports = function indexCache (kuzzle) {
  this.indexes = {};

  this.init = function () {
    kuzzle.services.list.readEngine.listIndexes(new RequestObject({}))
      .then(result => {
        result.data.body.indexes.forEach(index => {
          this.indexes[index] = [];

          kuzzle.services.list.readEngine.listCollections(new RequestObject({index: index}))
            .then(resultCollections => {
              this.indexes[index] = resultCollections.data.body.collections.stored;
            });
        });
      });
  };

  this.add = function (index, collection) {
    if (index !== undefined) {
      if (!this.indexes[index]) {
        this.indexes[index] = [];
      }

      if (collection) {
        if (this.indexes[index].indexOf(collection) === -1) {
          this.indexes[index].push(collection);
        }
      }
    }
  };

  this.remove = function (index, collection) {
    var position;

    if (index && this.indexes[index]) {
      if (collection) {
        position = this.indexes[index].indexOf(collection);

        if (position >= 0) {
          this.indexes[index].splice(position, 1);
        }
      }
      else {
        delete this.indexes[index];
      }
    }
  };

  this.reset = function (index) {
    if (index !== undefined) {
      this.indexes[index] = [];
    }
    else {
      this.indexes = {};
    }
  };
};

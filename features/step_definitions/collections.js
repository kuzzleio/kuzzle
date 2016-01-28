var apiSteps = function () {
  this.When(/^I list "([^"]*)" data collections(?: in index "([^"]*)")?$/, function (type, index, callback) {
    this.api.listCollections(index, type)
      .then(response => {
        if (response.error) {
          callback(new Error(response.error.message));
          return false;
        }

        if (!response.result) {
          return callback(new Error('No result provided'));
        }

        this.result = response.result;
        callback();
      })
      .catch(error => callback(error));
  });

  this.Then(/^I can ?(not)* find a ?(.*?) collection ?(.*)$/, function (not, type, collection, callback) {
    if (!this.result.collections) {
      return callback('Expected a collections list result, got: ' + this.result);
    }

    if (!collection) {
      if (this.result.collections[type].length === 0) {
        if (not) {
          return callback();
        }

        return callback('Collection list is empty, expected collections to be listed');
      }
    }

    if (this.result.collections[type].indexOf(collection) !== -1) {
      if (not) {
        return callback('Expected collection ' + collection + ' not to appear in the collection list');
      }

      return callback();
    }

    callback('Expected to find the collection <' + collection + '> in this collections list: ' + JSON.stringify(this.result.collections));
  });

  this.Then(/^I remove the collection and schema(?: from index "([^"]*)")?$/, function (index, callback) {
    this.api.deleteCollection(index)
      .then(function (body) {
        if (body.error !== null) {
          return callback(new Error(body.error.message));
        }

        callback();
      }.bind(this))
      .catch(function (error) {
        callback(new Error(error));
      });
  });

  this.Then(/^I change the schema(?: in index "([^"]*)")?$/, function (index, callback) {
    this.api.putMapping()
      .then(function (body) {
        if (body.error !== null) {
          callback(new Error(body.error.message));
          return false;
        }

        callback();
      }.bind(this))
      .catch(function (error) {
        callback(new Error(error));
      });
  });

  this.Then(/^I truncate the collection(?: "(.*?)")?(?: in index "([^"]*)")?$/, function (collection, index, callback) {
    this.api.truncateCollection(index, collection)
      .then(body => {
        if (body.error !== null) {
          return callback(new Error(body.error.message));
        }

        callback();
      })
      .catch(error => callback(error));
  });
};

module.exports = apiSteps;

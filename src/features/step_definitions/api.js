var async = require('async');

var apiSteps = function () {

  /** READ **/
  this.Then(/^I'm ?(not)* able to get the document$/, function (not, callback) {
    var main = function () {
      this.api.get(this.result.id)
        .then(function (body) {
          if (body.error) {
            callback.fail(new Error(body.error));
            return false;
          }

          if (!body.result || !body.result._source) {
            if (not !== undefined) {
              callback();
              return false;
            }

            callback.fail(new Error('No result provided'));
            return false;
          }

          if (not !== undefined) {
            callback.fail(new Error('Object with id '+ this.result.id + ' exists'));
            return false;
          }

          callback();
        }.bind(this))
        .catch(function (error) {
          if (not !== undefined) {
            callback();
            return false;
          }

          callback.fail(error);
        });
    };

    // waiting for ES indexation
    setTimeout(main.bind(this), 1500);
  });

  this.Then(/^my document has the value "([^"]*)" in field "([^"]*)"$/, function (value, field, callback) {
    var main = function () {
      this.api.get(this.result.id)
        .then(function (body) {

          if (body.error) {
            callback.fail(new Error(body.error));
            return false;
          }

          if (body.result._source[field] === undefined) {
            callback.fail(new Error('Undefined field ' + field));
            return false;
          }

          if (body.result._source[field] !== value) {
            callback.fail(new Error('Value in field ' + field + ' is ' + body.result._source[field] + ' expected to be ' + value));
            return false;
          }

          callback();
        })
        .catch(function (error) {
          callback.fail(error);
        });
    };

    // waiting for ES indexation
    setTimeout(main.bind(this), 1200);
  });

  this.Then(/^I found a document with "([^"]*)" in field "([^"]*)"$/, function (value, field, callback) {
    var main = function () {
      var filters = {filter: {term: {}}};
      filters.filter.term[field] = value;

      this.api.search(filters)
        .then(function (body) {

          if (body.error !== null) {
            callback.fail(new Error(body.error));
            return false;
          }

          if (body.result && body.result.hits && body.result.hits.total !== 0) {
            callback();
            return false;
          }

          callback.fail('No result for filter search');
        }.bind(this))
        .catch(function (error) {
          callback.fail(error);
        });
    };

    setTimeout(main.bind(this), 1200);
  });

  this.Then(/^I can retrieve actions from bulk import$/, function (callback) {
    var main = function () {
      // execute in parallel both tests: test if create/update work well and test if delete works well
      async.parallelLimit({
        testUpdate: function (callbackAsync) {
          this.api.get('1')
            .then(function (body) {
              if (body.error !== null) {
                callbackAsync(body.error);
                return false;
              }

              if (body.result && body.result._source && body.result._source.title === 'foobar') {
                callbackAsync();
                return false;
              }

              callbackAsync('Document was not updated or created successfully in bulk import');
            }.bind(this))
            .catch(function (error) {
              callbackAsync(error);
            });
        }.bind(this),
        testDelete: function (callbackAsync) {
          this.api.get('2')
            .then(function (body) {
              if (body.error !== null) {
                callbackAsync();
                return false;
              }

              if (body.result && body.result._source) {
                callbackAsync('Document still exists');
                return false;
              }

              callback();
            }.bind(this))
            .catch(function () {
              callbackAsync();
            });
        }.bind(this)
      }, 1, function (error) {
        if (error) {
          callback.fail(new Error(error));
          return false;
        }

        callback();
      }.bind(this)); // end async.parallel
    }; // end method main

    setTimeout(main.bind(this), 1200);
  });

  /** WRITE **/
  this.When(/^I write the document ?(?:"([^"]*)")?$/, function (documentName, callback) {

    var document = this[documentName] || this.documentGrace;

    this.api.create(document, true)
      .then(function (body) {
        if (body.error) {
          callback.fail(new Error(body.error));
          return false;
        }

        if (!body.result) {
          callback.fail(new Error('No result provided'));
          return false;
        }

        this.result = body.result;
        callback();
      }.bind(this))
      .catch(function (error) {
        callback.fail(error);
      });
  });

  this.Then(/^I should receive a document id$/, function (callback) {
    if (this.result && this.result.id) {
      callback();
      return false;
    }

    callback.fail(new Error('No id information in returned object'));
  });

  this.Then(/^I update the document with value "([^"]*)" in field "([^"]*)"$/, function (value, field, callback) {
    var main = function () {
      var body = {};
      body[field] = value;

      this.api.update(this.result.id, body)
        .then(function (body) {
          if (body.error) {
            callback.fail(new Error(body.error));
            return false;
          }

          if (!body.result) {
            callback.fail(new Error('No result provided'));
            return false;
          }

          callback();
        }.bind(this))
        .catch(function (error) {
          callback.fail(error);
        });
    };

    // waiting for ES indexation
    setTimeout(main.bind(this), 1200);
  });

  this.Then(/^I remove the document$/, function (callback) {
    this.api.deleteById(this.result.id)
      .then(function (body) {
        if (body.error !== null) {
          callback.fail(new Error(body.error));
          return false;
        }

        callback();
      }.bind(this))
      .catch(function (error) {
        callback.fail(error);
      });
  });

  this.When(/^I do a bulk import$/, function (callback) {
    this.api.bulkImport(this.bulk)
      .then(function (body) {
        if (body.error !== null) {
          callback.fail(new Error(body.error));
          return false;
        }

        callback();
      }.bind(this))
      .catch(function (error) {
        callback.fail(error);
      });
  });

  this.Then(/^I remove the collection/, function (callback) {
    this.api.deleteCollection()
      .then(function (body) {
        if (body.error !== null) {
          callback.fail(new Error(body.error));
          return false;
        }

        callback();
      }.bind(this))
      .catch(function (error) {
        callback.fail(new Error(error));
      });
  });
};

module.exports = apiSteps;
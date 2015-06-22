var async = require('async');

var apiSteps = function () {

  /** READ **/
  this.Then(/^I'm ?(not)* able to get the document$/, function (not, callback) {
    var main = function (callbackAsync) {
      setTimeout(function () {
        this.api.get(this.result._id)
          .then(function (body) {
            if (body.error) {
              if (body.error.message) {
                callbackAsync(body.error.message);
                return false;
              }

              callbackAsync(body.error);
              return false;
            }

            if (!body.result || !body.result._source) {
              if (not) {
                callbackAsync();
                return false;
              }

              callbackAsync('No result provided');
              return false;
            }

            if (not) {
              callbackAsync('Object with id '+ this.result._id + ' exists');
              return false;
            }

            callbackAsync();
          }.bind(this))
          .catch(function (error) {
            if (not) {
              callbackAsync();
              return false;
            }

            callbackAsync(error);
          });
      }.bind(this), 500); // end setTimeout
    };


    async.retry(20, main.bind(this), function (err) {
      if (err) {
        if (err.message) {
          err = err.message;
        }
        callback.fail(new Error(err));
        return false;
      }

      callback();
    });
  });


  this.Then(/^my document has the value "([^"]*)" in field "([^"]*)"$/, function (value, field, callback) {
    var main = function (callbackAsync) {
      setTimeout(function () {
        this.api.get(this.result._id)
          .then(function (body) {

            if (body.error) {
              callbackAsync(body.error);
              return false;
            }

            if (body.result._source[field] === undefined) {
              callbackAsync('Undefined field ' + field);
              return false;
            }

            if (body.result._source[field] !== value) {
              callbackAsync('Value in field ' + field + ' is ' + body.result._source[field] + ' expected to be ' + value);
              return false;
            }

            callbackAsync();
          })
          .catch(function (error) {
            callbackAsync(error);
          });
      }.bind(this), 500); // end setTimeout
    };

    async.retry(20, main.bind(this), function (err) {
      if (err) {
        if (err.message) {
          err = err.message;
        }

        callback.fail(new Error(err));
        return false;
      }

      callback();
    });
  });


  this.Then(/^I ?(don't)* find a document with "([^"]*)" in field "([^"]*)"$/, function (dont, value, field, callback) {
    var main = function (callbackAsync) {
      setTimeout(function () {
        var filters = {filter: {term: {}}};
        filters.filter.term[field] = value;

        this.api.search(filters)
          .then(function (body) {

            if (body.error !== null) {
              if (dont) {
                callbackAsync();
                return false;
              }

              callbackAsync(body.error);
              return false;
            }

            if (body.result && body.result.hits && body.result.hits.total !== 0) {
              if (dont) {
                callbackAsync('A document exists for the filter');
                return false;
              }

              callbackAsync();
              return false;
            }

            if (dont) {
              callbackAsync();
              return false;
            }

            callbackAsync('No result for filter search');
          }.bind(this))
          .catch(function (error) {
            if (dont) {
              callbackAsync();
              return false;
            }

            callbackAsync(error);
          });
      }.bind(this), 500); // end setTimeout
    };

    async.retry(20, main.bind(this), function (err) {
      if (err) {
        if (err.message) {
          err = err.message;
        }

        callback.fail(new Error(err));
        return false;
      }

      callback();
    });
  });


  this.Then(/^I can retrieve actions from bulk import$/, function (callback) {
    var main = function (callbackAsync) {
      setTimeout(function () {
        // execute in parallel both tests: test if create/update work well and test if delete works well
        async.parallelLimit({
          testUpdate: function (callbackAsyncParallel) {
            this.api.get('1')
              .then(function (body) {
                if (body.error !== null) {
                  callbackAsyncParallel(body.error);
                  return false;
                }

                if (body.result && body.result._source && body.result._source.title === 'foobar') {
                  callbackAsyncParallel();
                  return false;
                }

                callbackAsyncParallel('Document was not updated or created successfully in bulk import');
              }.bind(this))
              .catch(function (error) {
                callbackAsyncParallel(error);
              });
          }.bind(this),
          testDelete: function (callbackAsyncParallel) {
            this.api.get('2')
              .then(function (body) {
                if (body.error !== null) {
                  callbackAsyncParallel();
                  return false;
                }

                if (body.result && body.result._source) {
                  callbackAsyncParallel('Document still exists');
                  return false;
                }

                callback();
              }.bind(this))
              .catch(function () {
                callbackAsyncParallel();
              });
          }.bind(this)
        }, 1, function (error) {
          // Only when we have response from async.parallelLimit we can stop retry by calling callbackAsync
          if (error) {
            callbackAsync(error);
            return false;
          }

          callbackAsync();
        }.bind(this)); // end async.parallel
      }.bind(this), 500); // end setTimeout
    }; // end method main

    async.retry(20, main.bind(this), function (err) {
      if (err) {
        if (err.message) {
          err = err.message;
        }

        callback.fail(new Error(err));
        return false;
      }

      callback();
    });
  });

  this.Then(/^I count ([\d]*) documents$/, function (number, callback) {
    var main = function (callbackAsync) {
      setTimeout(function () {
        this.api.count({})
          .then(function (body) {
            if (body.error) {
              callbackAsync(body.error);
              return false;
            }

            if (body.result.count !== parseInt(number)) {
              callbackAsync('No correct value for count. Expected ' + number + ', get ' + body.result.count);
              return false;
            }

            callbackAsync();
          }.bind(this))
          .catch(function (error) {
            callbackAsync(error);
          });
      }.bind(this), 500); // end setTimeout
    };

    async.retry(20, main.bind(this), function (err) {
      if (err) {
        if (err.message) {
          err = err.message;
        }

        callback.fail(new Error(err));
        return false;
      }

      callback();
    });
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
    if (this.result && this.result._id) {
      callback();
      return false;
    }

    callback.fail(new Error('No id information in returned object'));
  });


  this.Then(/^I update the document with value "([^"]*)" in field "([^"]*)"$/, function (value, field, callback) {
    var main = function (callbackAsync) {
      setTimeout(function () {
        var body = {};
        body[field] = value;

        this.api.update(this.result._id, body)
          .then(function (body) {
            if (body.error) {
              callbackAsync(body.error);
              return false;
            }

            if (!body.result) {
              callbackAsync('No result provided');
              return false;
            }

            callbackAsync();
          }.bind(this))
          .catch(function (error) {
            callbackAsync(error);
          });
      }.bind(this), 500); // end setTimeout
    };

    async.retry(20, main.bind(this), function (err) {
      if (err) {
        callback.fail(new Error(err));
        return false;
      }

      callback();
    });
  });


  this.Then(/^I remove the document$/, function (callback) {
    this.api.deleteById(this.result._id)
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


  this.Then(/^I remove the collection and schema$/, function (callback) {
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


  this.Then(/^I change the schema$/, function (callback) {
    this.api.putMapping()
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


  /** TOOLS **/
  this.Then(/^I wait ([\d]*)s$/, function (time, callback) {
    setTimeout(function () {
      callback();
    }, time*1000);
  });

};

module.exports = apiSteps;
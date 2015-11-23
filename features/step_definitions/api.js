var async = require('async');

var apiSteps = function () {
  /** SUBSCRIPTION **/
  this.Given(/^A room subscription listening to "([^"]*)" having value "([^"]*)"(?: with socket "([^"]*)")?$/, function (key, value, socketName, callback) {
    var filter = { term: {} };

    filter.term[key] = value;
    this.api.subscribe(filter, socketName)
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

  this.Given(/^A room subscription listening to the whole collection$/, function (callback) {
    this.api.subscribe()
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

  this.Given(/^A room subscription listening field "([^"]*)" doesn't exists$/, function (key, callback) {
    var filter = {not: {exists: {field : null}}};

    filter.not.exists.field = key;
    this.api.subscribe(filter)
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

  /**
   * Unsubscribes from one of the subscribed rooms
   */
  this.Then(/^I unsubscribe(?: socket "([^"]*)")?/, function (socketName, callback) {
    var rooms;

    if (socketName) {
      rooms = Object.keys(this.api.subscribedRooms[socketName]);
    }
    else {
      socketName = Object.keys(this.api.subscribedRooms)[0];
      rooms = Object.keys(this.api.subscribedRooms[socketName]);
    }

    if (rooms.length === 0) {
      callback(new Error('Cannot unsubscribe: no subscribed rooms'));
      return false;
    }

    this.api.unsubscribe(rooms[rooms.length - 1], socketName)
      .then(function () {
        callback();
      })
      .catch(function (error) {
        callback(new Error(error));
      });
  });

  /** READ **/
  this.Then(/^I'm ?(not)* able to get the document$/, function (not, callback) {
    var main = function (callbackAsync) {
      setTimeout(function () {
        this.api.get(this.result._id)
          .then(function (body) {
            if (body.error && !not) {
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
      }.bind(this), 20); // end setTimeout
    };


    async.retry(20, main.bind(this), function (err) {
      if (err) {
        if (err.message) {
          err = err.message;
        }
        callback(new Error(err));
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
              callbackAsync(body.error.message);
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
      }.bind(this), 100); // end setTimeout
    };

    async.retry(20, main.bind(this), function (err) {
      if (err) {
        if (err.message) {
          err = err.message;
        }

        callback(new Error(err));
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

              callbackAsync(body.error.message);
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
      }.bind(this), 100); // end setTimeout
    };

    async.retry(20, main.bind(this), function (err) {
      if (err) {
        if (err.message) {
          err = err.message;
        }

        callback(new Error(err));
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
                  callbackAsyncParallel(body.error.message);
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
      }.bind(this), 20); // end setTimeout
    }; // end method main

    async.retry(20, main.bind(this), function (err) {
      if (err) {
        if (err.message) {
          err = err.message;
        }

        callback(new Error(err));
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
              callbackAsync(body.error.message);
              return false;
            }

            if (body.result.count !== parseInt(number)) {
              callbackAsync('No correct value for count. Expected ' + number + ', got ' + body.result.count);
              return false;
            }

            callbackAsync();
          }.bind(this))
          .catch(function (error) {
            callbackAsync(error);
          });
      }.bind(this), 100); // end setTimeout
    };

    async.retry(20, main.bind(this), function (err) {
      if (err) {
        if (err.message) {
          err = err.message;
        }

        callback(new Error(err));
        return false;
      }

      callback();
    });
  });

  this.Then(/^I count ([\d]*) documents with "([^"]*)" in field "([^"]*)"/, function (number, value, field, callback) {
    var main = function (callbackAsync) {
      setTimeout(function () {
        var filter = {
          query: {
            match: {}
          }
        };

        filter.query.match[field] = value;

        this.api.count(filter)
          .then(function (body) {
            if (body.error) {
              callbackAsync(body.error.message);
              return false;
            }

            if (body.result.count !== parseInt(number)) {
              callbackAsync('Wrong document count received. Expected ' + number + ', got ' + body.result.count);
              return false;
            }

            callbackAsync();
          }.bind(this))
          .catch(function (error) {
            callbackAsync(new Error(error));
          });
      }.bind(this), 20);
    };

    async.retry(20, main.bind(this), function (error) {
      if (error) {
        callback(new Error(error));
        return false;
      }

      callback();
    });
  });

  this.Then(/^I should receive a "([^"]*)" notification$/, function (action, callback) {
    var main = function (callbackAsync) {
      setTimeout(function () {
        if (this.api.responses) {
          if (this.api.responses.error) {
            callbackAsync('An error occurred ' + this.api.response.error.toString());
            return false;
          }

          if (this.api.responses.result.action !== action) {
            callbackAsync('Action "' + this.api.responses.result.action + '" received. Expected: "' + action + '"');
            return false;
          }

          callbackAsync();
        } else {
          callbackAsync('No notification received');
        }
      }.bind(this), 20);
    };

    async.retry(20, main.bind(this), function (err) {
      if (err) {
        if (err.message) {
          err = err.message;
        }

        callback(new Error(err));
        return false;
      }

      callback();
    });
  });

  this.Then(/^The notification should ?(not)* have a "([^"]*)" member/, function (not, member, callback) {
    if ( (this.api.responses.result[member] || not) && !(this.api.responses.result[member] && not)) {
      callback();
    }
    else {
      callback('The document was ' + (not ? 'not ' : '') + 'supposed to contain the member "' + member + '"');
    }
  });

  this.Then(/^The notification should have metadata$/, function (callback) {
    var
      diff = false;

    if (!this.api.responses.result.metadata) {
      return callback('Expected metadata in the notification but none was found');
    }

    diff = Object.keys(this.metadata).length !== Object.keys(this.api.responses.result.metadata).length;

    Object.keys(this.metadata).forEach(key => {
      if (!diff) {
        if (!this.api.responses.result.metadata[key]) {
          diff = true;
        } else {
          diff = JSON.stringify(this.metadata[key]).localeCompare(JSON.stringify(this.api.responses.result.metadata[key])) !== 0;
        }
      }
    });

    if (diff) {
      callback('Expected ' + JSON.stringify(this.api.responses.result.metadata) + ' to match ' + JSON.stringify(this.metadata));
    } else {
      callback();
    }

  });

  this.Then(/^I can count "([^"]*)" subscription/, function (number, callback) {
    this.api.countSubscription()
      .then(function (response) {
        if (response.error) {
          callback(new Error(response.error.message));
          return false;
        }

        if (!response.result.count || response.result.count !== parseInt(number)) {
          callback(new Error('No correct value for count. Expected ' + number + ', got ' + response.result));
          return false;
        }

        callback();
      })
      .catch(function (error) {
        callback(new Error(error));
      });
  });

  this.When(/^I list data collections$/, function (callback) {
    this.api.listCollections()
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

  this.When(/^I get the server timestamp$/, function(callback) {
    this.api.now()
      .then(response => {
        if (response.error) {
          return callback(new Error(response.error.message));
        }

        if (!response.result) {
          return callback(new Error('No result provided'));
        }

        this.result = response.result;
        callback();
      })
      .catch(error => callback(error));
  });

  this.Then(/^I can read the timestamp$/, function(callback) {
    if (!this.result.now || !Number.isInteger(this.result.now)) {
      return callback('Expected a timestamp result, got: ' + this.result);
    }

    callback();
  });

  this.When(/^I get the last statistics frame$/, function (callback) {
    this.api.getStats()
      .then(function (response) {
        if (response.error) {
          return callback(new Error(response.error.message));
        }

        if (!response.result) {
          return callback(new Error('No result provided'));
        }

        this.result = response.result;
        callback();
      }.bind(this))
      .catch(function (error) {
        callback(error);
      });
  });

  this.When(/^I get all statistics frames$/, function (callback) {
    this.api.getAllStats()
      .then(function (response) {
        if (response.error) {
          return callback(new Error(response.error.message));
        }

        if (!response.result) {
          return callback(new Error('No result provided'));
        }

        this.result = response.result;
        callback();
      }.bind(this))
      .catch(function (error) {
        callback(error);
      });
  });

  this.Then(/^I get at least 1 statistic frame$/, function (callback) {
    var key;

    if (!this.result.statistics) {
      return callback('Expected a statistics result, got: ' + this.result);
    }

    key = Object.keys(this.result.statistics);

    if (key.length > 0 &&
        this.result.statistics[key[0]].ongoingRequests &&
        this.result.statistics[key[0]].completedRequests &&
        this.result.statistics[key[0]].failedRequests &&
        this.result.statistics[key[0]].connections) {
      return callback();
    }

    callback('Expected at least 1 statistic frame, found: ' + this.result.statistics);
  });

  this.Then(/^I can find a collection "([^"]*)"$/, function (collection, callback) {
    if (!this.result.collections) {
      return callback('Expected a collections list result, got: ' + this.result);
    }

    if (Array.isArray(this.result.collections) && this.result.collections.indexOf(collection) !== -1) {
      return callback();
    }

    callback('Expected to find the collection <' + collection + '> in this collections list: ' + this.result.collections);
  });

  /** WRITE **/
  this.When(/^I write the document ?(?:"([^"]*)")?$/, function (documentName, callback) {
    var document = this[documentName] || this.documentGrace;

    this.api.create(document, true)
      .then(function (body) {
        if (body.error) {
          callback(new Error(body.error.message));
          return false;
        }

        if (!body.result) {
          callback(new Error('No result provided'));
          return false;
        }

        this.result = body.result;
        callback();
      }.bind(this))
      .catch(function (error) {
        callback(error);
      });
  });

  this.When(/^I createOrUpdate it$/, function (callback) {
    var document = JSON.parse(JSON.stringify(this.documentGrace));

    document._id = this.result._id;

    this.api.createOrUpdate(document)
      .then(function (body) {
        if (body.error) {
          callback(new Error(body.error.message));
          return false;
        }

        if (!body.result) {
          callback(new Error('No result provided'));
          return false;
        }

        this.updatedResult = body.result;
        callback();
      }.bind(this))
      .catch(function (error) {
        callback(error);
      });
  });

  this.Then(/^I should receive a document id$/, function (callback) {
    if (this.result && this.result._id) {
      callback();
      return false;
    }

    callback(new Error('No id information in returned object'));
  });

  this.Then(/^I should receive a request id$/, function (callback) {
    if (this.result && this.result.requestId) {
      callback();
      return false;
    }

    callback(new Error('No request id returned'));
  });

  this.Then(/^I should have updated the document$/, function (callback) {
    if (this.updatedResult._id === this.result._id && this.updatedResult._version === (this.result._version+1)) {
      this.result = this.updatedResult;
      callback();
      return false;
    }

    callback(new Error('The received document is not an updated version of the previous one. \n' +
      'Previous document: ' + JSON.stringify(this.result) + '\n' +
      'Received document: ' + JSON.stringify(this.updatedResult)));
  });

  this.Then(/^I update the document with value "([^"]*)" in field "([^"]*)"$/, function (value, field, callback) {
    var main = function (callbackAsync) {
      setTimeout(function () {
        var body = {};
        body[field] = value;

        this.api.update(this.result._id, body)
          .then(function (body) {
            if (body.error) {
              callbackAsync(body.error.message);
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
      }.bind(this), 20); // end setTimeout
    };

    async.retry(20, main.bind(this), function (err) {
      if (err) {
        callback(new Error(err));
        return false;
      }

      callback();
    });
  });


  this.Then(/^I remove the document$/, function (callback) {
    this.api.deleteById(this.result._id)
      .then(function (body) {
        if (body.error !== null) {
          callback(body.error.message);
          return false;
        }

        callback();
      }.bind(this))
      .catch(function (error) {
        callback(error);
      });
  });

  this.Then(/^I remove documents with field "([^"]*)" equals to value "([^"]*)"$/, function (field, value, callback) {
    var main = function (callbackAsync) {
      setTimeout(function () {
        var filter = { query: { match: {} } };

        filter.query.match[field] = value;

        this.api.deleteByQuery(filter)
          .then(function (body) {
            if (body.error) {
              callbackAsync(body.error.message);
              return false;
            }

            if (!body.result || body.result.ids.length === 0) {
              callbackAsync('No result provided');
              return false;
            }

            callbackAsync();
          }.bind(this))
          .catch(function (error) {
            callbackAsync(error);
          });
      }.bind(this), 20); // end setTimeout
    };

    async.retry(20, main.bind(this), function (err) {
      if (err) {
        callback(err);
        return false;
      }

      callback();
    });
  });


  this.When(/^I do a bulk import$/, function (callback) {
    this.api.bulkImport(this.bulk)
      .then(function (body) {
        if (body.error !== null) {
          callback(new Error(body.error.message));
          return false;
        }

        callback();
      }.bind(this))
      .catch(function (error) {
        callback(error);
      });
  });

  this.When(/^I do a global bulk import$/, function (callback) {
    this.api.globalBulkImport(this.globalBulk)
      .then(function (body) {
        if (body.error !== null) {
          callback(new Error(body.error.message));
          return false;
        }

        callback();
      }.bind(this))
      .catch(function (error) {
        callback(error);
      });
  });

  this.Then(/^I remove the collection and schema$/, function (callback) {
    this.api.deleteCollection()
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


  this.Then(/^I change the schema$/, function (callback) {
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

  this.Then(/^I truncate the collection$/, function (callback) {
    this.api.truncateCollection()
      .then(body => {
        if (body.error !== null) {
          return callback(new Error(body.error.message));
        }

        callback();
      })
      .catch(error => callback(error));
  });

  /** TOOLS **/
  this.Then(/^I wait ([\d]*)s$/, function (time, callback) {
    setTimeout(function () {
      callback();
    }, time*1000);
  });

};

module.exports = apiSteps;

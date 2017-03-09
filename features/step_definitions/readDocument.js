var
  async = require('async'),
  Promise = require('bluebird');

var apiSteps = function () {
  this.Then(/^I'm ?(not)* able to get the document(?: in index "([^"]*)")?$/, function (not, index, callback) {
    var main = function (callbackAsync) {
      this.api.get(this.result._id, index)
        .then(body => {
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
        })
        .catch(function (error) {
          if (not) {
            callbackAsync();
            return false;
          }

          callbackAsync(error);
        });
    };


    async.retry({times: 20, interval: 20}, main.bind(this), function (err) {
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

  this.Then(/^I ?(don't)* find a document with "([^"]*)"(?: in field "([^"]*)")?(?: in index "([^"]*)")?(?: with scroll "([^"]*)")?$/, function (dont, value, field, index, scroll) {
    var query = {query: { match: { [field]: (value === 'true' ? true : value) }}};
    var args = {};

    if (scroll) {
      args.scroll = scroll;
      args.from = 0;
      args.size = 1;
    }

    return this.api.search(query, index, null, args)
      .then(body => {
        if (body.error !== null) {
          if (dont) {
            return Promise.resolve();
          }

          return Promise.reject(body.error);
        }

        if (body.result && body.result._scroll_id) {
          this.scrollId = body.result._scroll_id;
        }

        if (body.result && body.result.hits && body.result.total !== 0) {
          if (dont) { return Promise.reject(new Error('A document exists for the query')); }
          return Promise.resolve();
        }

        if (dont) { return Promise.resolve(); }
        return Promise.reject(new Error('No result for query search'));
      })
      .catch(error => {
        if (dont) { return Promise.resolve(); }
        return Promise.reject(error);
      });
  });

  this.Then(/^I am ?(not)* able to scroll previous search$/, function (not) {
    if (!this.scrollId) {
      if (!not) {
        return Promise.reject(new Error('No scroll id from previous search available'));
      }

      return Promise.resolve();
    }

    return this.api.scroll(this.scrollId)
      .then(body => {
        if (body.error !== null) {
          if (not) {
            return Promise.resolve();
          }

          return Promise.reject(body.error);
        }

        if (body.result && body.result.hits && body.result.hits.length > 0) {
          if (not) { return Promise.reject(new Error('A document exists for the scrollId')); }
          return Promise.resolve();
        }

        if (not) { return Promise.resolve(); }
        return Promise.reject(new Error('No result for scrollId search'));
      })
      .catch(error => {
        if (not) { return Promise.resolve(); }
        return Promise.reject(error);
      });
  });

  this.Then(/^I should receive a document id$/, function (callback) {
    if (this.result && this.result._id) {
      callback();
      return false;
    }

    callback(new Error('No id information in returned object'));
  });

  this.Then(/^I get ([\d]+) documents '([^']+)'?$/, function (count, documents, callback) {
    documents = JSON.parse(documents);

    this.api.mGet({ids: documents})
      .then(response => {
        if (response.error !== null) {
          callback(response.error.message);
          return false;
        }
        else if(response.result.total !== Number.parseInt(count)) {
          callback('Document count (' + response.result.total + ') not as expected (' + count + ')');
          return false;
        }

        callback();
      })
      .catch(function (error) {
        callback(error);
      });
  });
};

module.exports = apiSteps;

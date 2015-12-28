var
  async = require('async');

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

  this.Then(/^I ?(don't)* find a document with "([^"]*)"(?: in field "([^"]*)")?(?: in index "([^"]*)")?$/, function (dont, value, field, index, callback) {
    var main = function (callbackAsync) {
      setTimeout(function () {
        var filters = {filter: {term: {}}};
        filters.filter.term[field] = value;

        this.api.search(filters, index)
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

  this.Then(/^I should receive a document id$/, function (callback) {
    if (this.result && this.result._id) {
      callback();
      return false;
    }

    callback(new Error('No id information in returned object'));
  });
};

module.exports = apiSteps;

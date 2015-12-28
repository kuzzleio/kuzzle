var
  async = require('async');

var apiSteps = function () {
  this.Then(/^I remove the document(?: in index "([^"]*)")?$/, function (index, callback) {
    this.api.deleteById(this.result._id, index)
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

  this.Then(/^I remove documents with field "([^"]*)" equals to value "([^"]*)"(?: in index "([^"]*)")?$/, function (field, value, index, callback) {
    var main = function (callbackAsync) {
      setTimeout(function () {
        var filter = { query: { match: {} } };

        filter.query.match[field] = value;

        this.api.deleteByQuery(filter, index)
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
};

module.exports = apiSteps;

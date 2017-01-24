var
  async = require('async');

var apiSteps = function () {
  this.Then(/^I remove the document(?: in index "([^"]*)")?$/, function (index, callback) {
    this.api.deleteById(this.result._id, index)
      .then(body => {
        if (body.error !== null) {
          callback(body.error.message);
          return false;
        }

        callback();
      })
      .catch(function (error) {
        callback(error);
      });
  });

  this.Then(/^I remove documents with field "([^"]*)" equals to value "([^"]*)"(?: in index "([^"]*)")?$/, function (field, value, index, callback) {
    var main = function (callbackAsync) {
      setTimeout(function () {
        var query = { query: { match: {} } };

        query.query.match[field] = value;

        this.api.deleteByQuery(query, index)
          .then(body => {
            if (body.error) {
              callbackAsync(body.error.message);
              return false;
            }

            if (!body.result || body.result.ids.length === 0) {
              callbackAsync('No result provided');
              return false;
            }

            callbackAsync();
          })
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

  this.Then(/^I remove the documents '([^']+)'( and get partial errors)?$/, function (documents, withErrors, callback) {
    documents = JSON.parse(documents);

    this.api.mDelete({ids: documents})
      .then(response => {
        if (response.error !== null && !withErrors) {
          callback(response.error.message);
          return false;
        }
        else if(response.errors === null && withErrors) {
          callback('Should get partial error');
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

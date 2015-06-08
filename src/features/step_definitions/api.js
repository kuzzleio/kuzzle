var apiSteps = function () {

  /** READ **/
  this.Then(/^I'm ?(not)* able to get the document$/, function (not, callback) {
    var main = function () {
      this.getDocumentById(this.result.id)
        .then(function (body) {
          if (body.error) {
            callback.fail(new Error(body.error));
            return false;
          }

          if (!body.result || !body.result.hits || body.result.hits.hits.length === 0) {
            if (not !== undefined) {
              callback();
              return false;
            }

            callback.fail(new Error('No result provided'));
            return false;
          }

          if (not !== undefined) {
            callback.fail(new Error('Object with id '+ this.result.id + 'exists'));
            return false;
          }

          callback();
        }.bind(this))
        .catch(function (error) {
          callback.fail(error);
        });
    };

    // waiting for ES indexation
    setTimeout(main.bind(this), 1000);
  });

  this.Then(/^my document has the value "([^"]*)" in field "([^"]*)"$/, function (value, field, callback) {
    var main = function () {
      this.getDocumentById(this.result.id)
        .then(function (body) {
          if (body.error) {
            callback.fail(new Error(body.error));
            return false;
          }

          if (!body.result || !body.result.hits || body.result.hits.hits.length === 0) {
            callback.fail(new Error('No result'));
            return false;
          }

          if (body.result.hits.hits[0]._source[field] === undefined) {
            callback.fail(new Error('Undefined field ' + field));
            return false;
          }

          if (body.result.hits.hits[0]._source[field] !== value) {
            callback.fail(new Error('Value in field ' + field + ' is ' + body.result.hits.hits[0]._source[field] + ' expected to be ' + value));
            return false;
          }

          callback();
        })
        .catch(function (error) {
          callback.fail(error);
        });
    };

    // waiting for ES indexation
    setTimeout(main.bind(this), 1000);
  });



  /** WRITE **/
  this.When(/^I write document$/, function (callback) {
    var options = {
      url: this.pathApi(this.fakeCollection),
      method: 'POST',
      json: this.documentGrace
    };

    this.callApi(options)
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
      var options = {
        url: this.pathApi(this.fakeCollection + '/' + this.result.id),
        method: 'POST',
        json: {}
      };

      options.json[field] = value;

      this.callApi(options)
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
    setTimeout(main.bind(this), 1000);
  });

  this.Then(/^I remove the document$/, function (callback) {
    var options = {
      url: this.pathApi(this.fakeCollection + '/' + this.result.id),
      method: 'DELETE',
      json: true
    };

    this.callApi(options)
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
};

module.exports = apiSteps;
var
  async = require('async');

var apiSteps = function () {
  this.When(/^I ?(can't)* write the document ?(?:"([^"]*)")?(?: in index "([^"]*)")?(with auth token)?$/, function (cant, documentName, index, auth, callback) {
    var
      collection,
      jwtToken,
      document = this[documentName] || this.documentGrace;

    if (Boolean(auth)) {
      if (!Boolean(this.jwtToken)) {
        callback(new Error('Cannot retrieve jwt token'));
        return false;
      }
      jwtToken = this.jwtToken;
    }


    this.api.create(document, index, collection, jwtToken)
      .then(function (body) {
        if (body.error) {
          if (cant) {
            callback();
            return true;
          }
          else {
            callback(new Error(body.error.message));
            return false;
          }
        }

        if (!body.result) {
          callback(new Error('No result provided'));
          return false;
        }

        this.result = body.result;
        callback();
      }.bind(this))
      .catch(function (error) {
        if (cant) {
          callback();
          return true;
        }
        callback(error);
      });
  });

  this.When(/^I createOrReplace it$/, function (callback) {
    var document = JSON.parse(JSON.stringify(this.documentGrace));

    document._id = this.result._id;

    this.api.createOrReplace(document)
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

  this.Then(/^I update the document with value "([^"]*)" in field "([^"]*)"(?: in index "([^"]*)")?$/, function (value, field, index, callback) {
    var main = function (callbackAsync) {
      setTimeout(function () {
        var body = {};
        body[field] = value;

        this.api.update(this.result._id, body, index)
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
};

module.exports = apiSteps;

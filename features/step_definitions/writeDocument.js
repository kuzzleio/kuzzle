var
  async = require('async'),
  q = require('q');

var apiSteps = function () {
  this.When(/^I ?(can't)* write the document ?(?:"([^"]*)")?(?: in index "([^"]*)")?$/, function (cant, documentName, index, callback) {
    var
      document = this[documentName] || this.documentGrace;

    this.api.create(document, index)
      .then(function (body) {
        if (body.error) {
          if (cant) {
            callback();
            return true;
          }

          callback(body.error);
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
      .then((body) => {
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
      })
      .catch(function (error) {
        callback(error);
      });
  });

  this.Then(/^I should have updated the document$/, function (callback) {
    if (this.updatedResult._id === this.result._id && this.updatedResult._version === (this.result._version + 1)) {
      this.result = this.updatedResult;
      callback();
      return false;
    }

    callback(new Error('The received document is not an updated version of the previous one. \n' +
      'Previous document: ' + JSON.stringify(this.result) + '\n' +
      'Received document: ' + JSON.stringify(this.updatedResult)));
  });

  this.Then(/^I update the document with value "([^"]*)" in field "([^"]*)"(?: in index "([^"]*)")?$/, function (value, field, index) {
    var body = {};
    body[field] = value;

    return this.api.update(this.result._id, body, index)
      .then(body => {
        if (body.error) {
          return q.reject(body.error);
        }
        if (!body.result) {
          return q.reject('No result provided');
        }
      });
  });

  this.Then(/^I replace the document with "([^"]*)" document$/, function (documentName, callback) {
    var document = JSON.parse(JSON.stringify(this[documentName]));

    document._id = this.result._id;
    this.api.replace(document)
      .then((body) => {
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
      })
      .catch(function (error) {
        callback(error);
      });
  });
};

module.exports = apiSteps;

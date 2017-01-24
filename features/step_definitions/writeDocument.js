var
  Promise = require('bluebird');

var apiSteps = function () {
  this.When(/^I ?(can't)* write the document ?(?:"([^"]*)")?(?: in index "([^"]*)")?( with id "[^"]+")?$/, function (cant, documentName, index, id, callback) {
    var
      document = this[documentName] || this.documentGrace;

    if (id) {
      id = id.replace(/^ with id "([^"]+)"$/, '$1');
    }

    this.api.create(document, index, null, null, id)
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
    var body = {
      [field]: value
    };

    return this.api.update(this.result._id, body, index)
      .then(aBody => {
        if (aBody.error) {
          return Promise.reject(aBody.error);
        }
        if (!aBody.result) {
          return Promise.reject(new Error('No result provided'));
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

  this.When(/^I create multiple documents '([^']+)'( and get partial errors)?$/, function (documents, withErrors, callback) {
    var body = {documents: []};
    documents = JSON.parse(documents);

    Object.keys(documents).forEach(key => {
      body.documents.push({_id: key, body: this[documents[key]]});
    });

    this.api.mCreate(body)
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

  this.When(/^I replace multiple documents '([^']+)'( and get partial errors)?$/, function (documents, withErrors, callback) {
    var body = {documents: []};
    documents = JSON.parse(documents);

    Object.keys(documents).forEach(key => {
      body.documents.push({_id: key, body: this[documents[key]]});
    });

    this.api.mReplace(body)
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

  this.When(/^I update multiple documents '([^']+)'( and get partial errors)?$/, function (documents, withErrors, callback) {
    var body = {documents: []};
    documents = JSON.parse(documents);

    Object.keys(documents).forEach(key => {
      body.documents.push({_id: key, body: this[documents[key]]});
    });

    this.api.mUpdate(body)
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

  this.When(/^I createOrReplace multiple documents '([^']+)'( and get partial errors)?$/, function (documents, withErrors, callback) {
    var body = {documents: []};
    documents = JSON.parse(documents);

    Object.keys(documents).forEach(key => {
      body.documents.push({_id: key, body: this[documents[key]]});
    });

    this.api.mCreateOrReplace(body)
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

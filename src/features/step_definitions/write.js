var writeSteps = function () {
  this.When(/^I write document$/, function (callback) {
    var options = {
      url: this.pathApi('user'),
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
    if (this.result && this.result.content && this.result.content._id) {
      callback();
      return false;
    }

    callback.fail(new Error('No _id information in returned object'));
  });
};

module.exports = writeSteps;
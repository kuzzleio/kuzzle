var
  _ = require('lodash');


module.exports = function () {

  this.When(/^I call the (.*?) method of the memory storage with arguments (.*?)$/, function (command, args, callback) {
    var realArgs;

    if (args && args !== '') {
      try{
        realArgs = JSON.parse(args.replace(/#prefix#/g, this.idPrefix));
      }
      catch(err) {
        return callback(err);
      }
    }

    this.api.callMemoryStorage(command, realArgs)
      .then(response => {
        // console.log(response);
        if (response.error) {
          return callback(new Error(response.error.message));
        }

        callback();
      })
      .catch(error => {
        callback(error);
      });
  });

  this.Then(/^The ms result should match the (regex|json) (.*?)$/, function (type, pattern, callback) {
    var
      regex;

    if (type === 'regex') {
      regex = new RegExp(pattern.replace(/#prefix#/g, this.idPrefix));
      if (regex.test(this.memoryStorageResult.result.toString())) {
        callback();
      }
      else {
        callback(new Error('pattern mismatch: \n' + JSON.stringify(this.memoryStorageResult.result) + '\n does not match \n' + regex));
      }
    }

    if (type === 'json') {
      pattern = pattern.replace(/#prefix#/g, this.idPrefix);
      if (_.matches(JSON.parse(pattern))(this.memoryStorageResult.result)) {
        callback();
      }
      else {
        return callback(new Error('Error: ' + JSON.stringify(this.memoryStorageResult.result) + ' does not match ' + pattern));
      }
    }
  });
};

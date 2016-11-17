var should = require('should');

module.exports = function () {

  this.Then(/^The (sorted )?result should match the (regex|json) (.*?)$/, function (sorted, type, pattern, callback) {
    var
      regex,
      val = this.result.result;

    if (sorted && Array.isArray(val)) {
      val = val.sort();
    }

    if (type === 'regex') {
      regex = new RegExp(pattern.replace(/#prefix#/g, this.idPrefix));
      if (regex.test(val.toString())) {
        callback();
      }
      else {
        callback(new Error('pattern mismatch: \n' + JSON.stringify(val) + '\n does not match \n' + regex));
      }
    }

    if (type === 'json') {
      pattern = pattern.replace(/#prefix#/g, this.idPrefix);

      try {
        should(JSON.parse(pattern)).be.eql(val);
        callback();
      }
      catch(err) {
        if (err instanceof should.AssertionError) {
          return callback(new Error(JSON.stringify(val) + ' does not match ' + pattern));
        }

        return callback(err);
      }
    }
  });

  this.Then(/^The result should raise an error with message "(.*?)"$/, function (message, callback) {
    var
      val = this.result.error.error || this.result.error;

    try {
      should(val.message).be.eql(message);
      callback();
    }
    catch(err) {
      if (err instanceof should.AssertionError) {
        return callback(new Error(`"${val.message}" does not match "${message}"`));
      }

      return callback(err);
    }
  });
};

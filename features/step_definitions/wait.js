var apiSteps = function () {
  this.Then(/^I wait ([\d]*?)s$/, function (time, callback) {
    setTimeout(function () {
      callback();
    }, time*1000);
  });
};

module.exports = apiSteps;

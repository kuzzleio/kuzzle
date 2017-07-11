const
  {
    defineSupportCode
  } = require('cucumber');

defineSupportCode(function ({Then}) {
  Then(/^I wait ([\d]*?)s$/, function (time, callback) {
    setTimeout(function () {
      callback();
    }, time*1000);
  });

});


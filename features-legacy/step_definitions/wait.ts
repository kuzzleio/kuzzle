import { Then } from "@cucumber/cucumber";

Then(/^I wait ([\d.]*?)s$/, function (time, callback) {
  setTimeout(function () {
    callback();
  }, time * 1000);
});

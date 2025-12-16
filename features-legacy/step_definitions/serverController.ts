import should from "should";
import { When, Then } from "@cucumber/cucumber";

When("I get the public API", function () {
  return this.api.serverPublicApi().then(({ result }) => {
    this.apiResult = result;
  });
});

Then("I have the definition of kuzzle and plugins controllers", function () {
  const kuzzleControllers = [
      "auth",
      "bulk",
      "collection",
      "document",
      "index",
      "ms",
      "memoryStorage",
      "realtime",
      "security",
      "server",
      "admin",
    ],
    responseControllers = Object.keys(this.apiResult);

  for (const controllerName of kuzzleControllers) {
    should(responseControllers).containEql(controllerName);

    for (const actionName of Object.keys(this.apiResult[controllerName])) {
      const action = this.apiResult[controllerName][actionName];

      should(action.controller).eql(controllerName);
      should(action.action).eql(actionName);

      if (
        controllerName !== "realtime" ||
        ["list", "publish"].includes(actionName)
      ) {
        should(action.http).be.instanceOf(Array);
      }
    }
  }
});

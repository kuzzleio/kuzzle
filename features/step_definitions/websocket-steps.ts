import should from "should";
import { Given, Then, When } from "@cucumber/cucumber";
import ws from "ws";

Given("I open a new local websocket connection", function () {
  return new Promise((resolve) => {
    this.props.client = new ws("ws://localhost:7512");
    this.props.client.on("message", (data) => {
      this.props.result = JSON.parse(data);
      this.props.response = this.props.result;
    });
    this.props.client.on("open", () => {
      return resolve(true);
    });
  });
});

When(
  "I send the message {string} to Kuzzle through websocket",
  function (message) {
    this.props.client.send(message);
  },
);

Then("I wait to receive a websocket response from Kuzzle", function () {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (this.props.result) {
        clearInterval(interval);
        return resolve(true);
      }
    }, 200);
  });
});

Then(
  "I should receive a response message from Kuzzle through websocket matching:",
  function (dataTable) {
    const message = this.parseObject(dataTable);
    should(this.props.result).be.eql(message);
  },
);

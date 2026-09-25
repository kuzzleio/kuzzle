import { Given } from "@cucumber/cucumber";

Given(
  "I {string} the {string} pipe on {string} with the following changes:",
  async function (state, kind, event, dataTable) {
    const controller =
      kind === "plugin" ? "functional-test-plugin/pipes" : "pipes";
    const payload = this.parseObject(dataTable);
    const request = {
      action: "manage",
      body: payload,
      controller,
      event,
      state,
    };

    await this.sdk.query(request);
  },
);

Given(
  "I {string} the {string} pipe on {string} without changes",
  async function (state, kind, event) {
    const controller =
      kind === "plugin" ? "functional-test-plugin/pipes" : "pipes";

    await this.sdk.query({
      action: "manage",
      controller,
      event,
      state,
    });
  },
);

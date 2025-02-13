import rp from "request-promise";

test("Check _ready result", async () => {
  const response = rp.get({
    uri: "http://localhost:17510/_ready",
  });
  
  await expect(response).resolves.not.toThrow(); // Should return 200
});

test("Check _ready during node startup", async () => {
  let response = await rp.get({
    uri: "http://localhost:17510/tests/simulate-outage?type=nodeNotStarted",
  });

  response = rp.get({
    uri: "http://localhost:17510/_ready",
  });
  
  await expect(response).resolves.toThrow(); // Should return 503

  response = await rp.get({
    uri: "http://localhost:17510/tests/clear-outage",
  });
});

test("Check _ready during node overload", async () => {
  let response = await rp.get({
    uri: "http://localhost:17510/tests/simulate-outage?type=overload",
  });

  response = rp.get({
    uri: "http://localhost:17510/_ready",
  });
  
  await expect(response).resolves.toThrow(); // Should return 503

  response = await rp.get({
    uri: "http://localhost:17510/tests/clear-outage",
  });
});

test("Check _ready during node shutdown", async () => {
  let response = await rp.get({
    uri: "http://localhost:17510/tests/simulate-outage?type=shutdown",
  });

  response = rp.get({
    uri: "http://localhost:17510/_ready",
  });
  
  await expect(response).resolves.toThrow(); // Should return 503

  response = await rp.get({
    uri: "http://localhost:17510/tests/clear-outage",
  });
});

test("Check _ready during network outage", async () => {
  let response = await rp.get({
    uri: "http://localhost:17510/tests/simulate-outage?type=notEnoughNodes",
  });

  response = rp.get({
    uri: "http://localhost:17510/_ready",
  });
  
  await expect(response).resolves.toThrow(); // Should return 503

  response = await rp.get({
    uri: "http://localhost:17510/tests/clear-outage",
  });
});

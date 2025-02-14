import rp from "request-promise";

test("Check _ready result", async () => {
  const response = rp.get({
    uri: "http://localhost:17510/_ready",
  });
  
  await expect(response).resolves.not.toThrow(); // Should return 200
});

test("Check _ready during node startup", async () => {
  await rp.get({
    uri: "http://localhost:17510/tests/simulate-outage?type=nodeNotStarted",
  });

  const response = rp.get({
    uri: "http://localhost:17510/_ready",
  });
  
  await expect(response).rejects; // Should return 503

  await rp.get({
    uri: "http://localhost:17510/tests/clear-outage",
  });
});

test("Check _ready during node overload", async () => {
  await rp.get({
    uri: "http://localhost:17510/tests/simulate-outage?type=overload",
  });

  const response = rp.get({
    uri: "http://localhost:17510/_ready",
  });
  
  await expect(response).rejects; // Should return 503

  await rp.get({
    uri: "http://localhost:17510/tests/clear-outage",
  });
});


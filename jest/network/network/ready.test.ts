import rp from "request-promise";

test("Check _ready result", async () => {
  const response = rp.get({
    uri: "http://localhost:17510/_ready",
  });
  
  await expect(response).resolves.not.toThrow(); // Should return 200
});


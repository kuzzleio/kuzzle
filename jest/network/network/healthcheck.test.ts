import http from "http";

test("Check healthcheck result", () => {
  http.get(
    {
      hostname: "localhost",
      port: 7512,
      path: "/_healthcheck",
      headers: {},
    },
    (res) => {
      let rawData = "";

      res.on("data", (chunk) => {
        rawData += chunk;
      });

      res.on("end", () => {
        const parsedData = JSON.parse(rawData);
        expect(parsedData.status).toEqual(200);
      });
    }
  );
});

// See https://docs.kuzzle.io/core/2/api/controllers/admin/load-mappings/
export default {
  "mtp-open-data": {
    "green-taxi": {
      properties: {
        age: { type: "integer" },
        city: { type: "keyword" },
        job: { type: "keyword" },
        name: { type: "keyword" },
      },
    },
  },
  "nyc-open-data": {
    "yellow-taxi": {
      properties: {
        age: { type: "integer" },
        city: { type: "keyword" },
        field: {
          properties: {
            path: {
              type: "keyword",
            },
          },
        },
        foo: {
          type: "keyword",
        },
        job: { type: "keyword" },
        name: { type: "keyword" },
      },
    },
  },
};

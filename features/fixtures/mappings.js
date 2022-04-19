'use strict';

// See https://docs.kuzzle.io/core/2/api/controllers/admin/load-mappings/
module.exports = {
  'nyc-open-data': {
    'yellow-taxi': {
      properties: {
        job: { type: 'keyword' },
        name: { type: 'keyword' },
        age: { type: 'integer' },
        city: { type: 'keyword' },
      }
    }
  },
  'mtp-open-data': {
    'green-taxi': {
      properties: {
        job: { type: 'keyword' },
        name: { type: 'keyword' },
        age: { type: 'integer' },
        city: { type: 'keyword' },
      }
    }
  }
};

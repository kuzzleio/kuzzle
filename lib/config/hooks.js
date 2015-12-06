module.exports = {
  // emit when a request is received by server http (/lib/api/core/servers.js)
  'data:create': ['write:add'],
  'data:createOrUpdate': ['write:add'],
  'data:update': ['write:add'],
  'data:delete': ['write:add'],
  'data:deleteByQuery': ['write:add'],
  'data:bulkImport': ['write:add'],
  'data:putMapping': ['write:add'],
  'data:createCollection': ['write:add'],
  'data:deleteCollection': ['write:add'],
  'data:truncateCollection': ['write:add'],
  'data:listIndexes': [],
  'data:createIndex': ['write:add'],
  'data:deleteIndex': ['write:add'],
  'data:deleteIndexes': ['write:add'],
  'data:putRole': []
};


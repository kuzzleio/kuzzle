module.exports = {
  // emit when a request is received by server http (/lib/api/core/servers.js)
  'data:create': ['write:add'],
  'data:update': ['write:add'],
  'data:delete': ['write:add'],
  'data:deleteByQuery': ['write:add'],
  'data:bulkImport': ['write:add'],
  'data:deleteCollection': ['write:add'],
  'data:putMapping': ['write:add'],
  'data:reset': ['write:add']
};


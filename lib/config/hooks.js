module.exports = {
  'data:create': ['write:add', 'publish:add'],
  'data:createOrReplace': ['write:add', 'publish:add'],
  'data:replace': ['write:add', 'publish:add'],
  'data:update': ['write:add'],
  'data:delete': ['write:add', 'publish:add'],
  'data:deleteByQuery': ['write:add'],
  'data:bulkImport': ['write:add'],
  'data:updateMapping': ['write:add'],
  'data:createCollection': ['write:add'],
  'data:deleteCollection': ['write:add'],
  'data:truncateCollection': ['write:add'],
  'data:publish': [],
  'data:listIndexes': [],
  'data:createIndex': ['write:add'],
  'data:deleteIndex': ['write:add'],
  'data:deleteIndexes': ['write:add'],
  'data:createOrReplaceRole': [],
  'data:createOrReplaceProfile': []
};


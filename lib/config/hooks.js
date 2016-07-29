module.exports = {
  'data:beforeCreate': ['write:emit', 'publish:add'],
  'data:beforeCreateOrReplace': ['write:emit', 'publish:add'],
  'data:beforeReplace': ['write:emit', 'publish:add'],
  'data:beforeUpdate': ['write:emit'],
  'data:beforeDelete': ['write:emit', 'publish:add'],
  'data:beforeDeleteByQuery': ['write:emit'],
  'data:beforeBulkImport': ['write:emit'],
  'data:beforeUpdateMapping': ['write:emit'],
  'data:beforeCreateCollection': ['write:emit'],
  'data:beforeTruncateCollection': ['write:emit'],
  'data:beforeCreateIndex': ['write:emit'],
  'data:beforeDeleteIndex': ['write:emit'],
  'data:beforeDeleteIndexes': ['write:emit'],
  'data:beforeRefreshIndex': ['write:emit'],
  'data:beforeSetAutoRefresh': ['write:broadcast'],
  'data:beforeGetAutoRefresh': ['write:emit'],
  'cleanDb:deleteIndexes': ['write:emit']
};


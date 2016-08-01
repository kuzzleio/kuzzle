module.exports = {
  'data:beforeCreate': ['publish:add'],
  'data:beforeCreateOrReplace': ['publish:add'],
  'data:beforeReplace': ['publish:add'],
  'data:beforeUpdate': [],
  'data:beforeDelete': ['publish:add'],
  'data:beforeDeleteByQuery': [],
  'data:beforeBulkImport': [],
  'data:beforeUpdateMapping': [],
  'data:beforeCreateCollection': [],
  'data:beforeTruncateCollection': [],
  'data:beforeCreateIndex': [],
  'data:beforeDeleteIndex': [],
  'data:beforeDeleteIndexes': [],
  'data:beforeRefreshIndex': [],
  'data:beforeSetAutoRefresh': [],
  'data:beforeGetAutoRefresh': [],
  'cleanDb:deleteIndexes': []
};


module.exports = {
  'write:beforeCreate': ['publish:add'],
  'write:beforeCreateOrReplace': ['publish:add'],
  'write:beforeReplace': ['publish:add'],
  'write:beforeUpdate': [],
  'write:beforeDelete': ['publish:add'],
  'write:beforeDeleteByQuery': [],
  'bulk:beforeImport': [],
  'admin:beforeUpdateMapping': [],
  'admin:beforeCreateCollection': [],
  'admin:beforeTruncateCollection': [],
  'admin:beforeCreateIndex': [],
  'admin:beforeDeleteIndex': [],
  'admin:beforeDeleteIndexes': [],
  'admin:beforeRefreshIndex': [],
  'admin:beforeSetAutoRefresh': [],
  'admin:beforeGetAutoRefresh': [],
  'cleanDb:deleteIndexes': []
};


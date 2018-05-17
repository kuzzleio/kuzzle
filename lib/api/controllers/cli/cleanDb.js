/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const 
  Bluebird = require('bluebird'),
  Request = require('kuzzle-common-objects').Request;

module.exports = function cliResetStorage (kuzzle) {
  return (request, statusUpdate) => resetStorage(kuzzle, statusUpdate);
};

/**
 * Flushes the internal storage components (internalEngine index, cache and memory storage)
 *
 * @param {Kuzzle} kuzzle 
 * @param {Function} statusUpdate 
 * @returns Promise
 */
// eslint-disable-next-line no-console
function resetStorage (kuzzle, statusUpdate = console.log) {
  statusUpdate('Kuzzle reset initiated: this may take a while...');
  
  return deleteUsers(kuzzle, statusUpdate)
    .then(() => kuzzle.internalEngine.deleteIndex())
    .then(() => statusUpdate('Kuzzle internal database deleted'))
    .then(() => kuzzle.services.list.internalCache.flushdb())
    .then(() => {
      kuzzle.indexCache.remove(kuzzle.internalEngine.index);
      statusUpdate('Kuzzle internal cache flushed');

      return kuzzle.internalEngine.bootstrap.all();
    });
}


/**
 * @param {Kuzzle} kuzzle 
 * @param {Function} statusUpdate 
 * @param {object} part
 * @param {Promise<undefined>}
 */
function deleteUsers(kuzzle, statusUpdate, part = null) {
  if (part === null) {
    return kuzzle.repositories.user.search({}, {scroll: '10m', size: 100})
      .then(users => {
        statusUpdate(`${users.total} users found`);

        return deleteUsersPart(kuzzle, users)
          .then(() => {
            statusUpdate(`... ${users.hits.length}/${users.total} users deleted`);

            if (users.hits.length < users.total) {
              return deleteUsers(kuzzle, statusUpdate, {
                total: users.total, 
                deleted: users.hits.length, 
                scrollId: users.scrollId
              });
            }

            return null;
          });
      });
  }

  return kuzzle.repositories.user.scroll(part.scrollId, '10m')
    .then(users => {
      return deleteUsersPart(kuzzle, users)
        .then(() => {
          part.deleted += users.hits.length;
          statusUpdate(`... ${part.deleted}/${part.total} users deleted`);

          if (part.deleted < part.total) {
            part.scrollId = users.scrollId;
            return deleteUsers(kuzzle, statusUpdate, part);
          }

          return null;
        });
    });
}

function deleteUsersPart (kuzzle, users) {
  const promises = [];

  for (let i = 0; i < users.hits.length; i++) {
    const request = new Request({_id: users.hits[i]._id});
    promises.push(kuzzle.funnel.controllers.security.deleteUser(request));
  }

  return Bluebird.all(promises);
}

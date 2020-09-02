--
-- Kuzzle, a backend software, self-hostable and ready to use
-- to power modern apps
--
-- Copyright 2015-2018 Kuzzle
-- mailto: support AT kuzzle.io
-- website: http://kuzzle.io
--
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
-- https://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.
--

local hash_tag = KEYS[1]
local result = {redis.call('GET', 'cluster:version' .. hash_tag), {}}
local filters = redis.call('HGETALL', 'cluster:filters:' .. hash_tag)
local room_id

for i=1, #filters
do
  if i % 2 ~= 0
  then
    room_id = filters[i]
  else
    result[2][i/2] = {
      room_id,
      filters[i],
      redis.call('SCARD', 'cluster:room_clients:' .. hash_tag .. room_id)
    }
  end
end

return result

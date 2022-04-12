/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

'use strict';

const url = require('url');

/*
 * Compatibility plugin for the legacy Kuzzle cluster code
 */

class LegacyCluster {
  constructor () {
  }

  init (config, context) {
    context.log.warn('The cluster plugin is deprecated and can be safely removed: this plugin now only prevents breaking changes by adding the previously exposed API actions, and converts the old cluster configuration to the new version');

    const clusterConfig = global.kuzzle.config.cluster;

    if (config) {
      if (config.minimumNodes) {
        clusterConfig.minimumNodes = config.minimumNodes;
      }

      if (config.bindings) {
        let family = 'ipv4';

        if (config.bindings.pub) {
          const { ipv6, port } = resolveBinding(
            config.bindings.pub,
            clusterConfig.ports.sync);

          if (ipv6) {
            family = 'ipv6';
          }

          clusterConfig.ports.sync = port;
        }

        if (config.bindings.router) {
          const { ipv6, port } = resolveBinding(
            config.bindings.router,
            clusterConfig.ports.command);

          if (family !== 'ipv6' && ipv6) {
            family = 'ipv6';
          }

          clusterConfig.ports.command = port;
        }

        if (family === 'ipv6') {
          clusterConfig.ipv6 = true;
        }
      }
    }

    this.controllers = {
      cluster: {
        health: 'clusterHealthAction',
        reset: 'clusterResetAction',
        status: 'clusterStatusAction'
      }
    };

    this.routes = [
      {action: 'health', controller: 'cluster', path: '/health', verb: 'get', },
      {action: 'reset', controller: 'cluster', path: '/reset', verb: 'post', },
      {action: 'status', controller: 'cluster', path: '/status', verb: 'get', },
    ];
  }


  /**
   * @deprecated - added for backward compatibility only
   *
   * Returns "ok" if the cluster is able to respond. This route is obsolete
   * because now, if there aren't enough nodes in the cluster, any API action
   * returns a proper "api.process.not_enough_nodes" error (code 503) and
   * Kuzzle refuses to process it.
   *
   * @return {string}
   */
  clusterHealthAction () {
    return 'ok';
  }

  /**
   * @deprecated - added for backward compatibility only
   *
   * This action originally "resets" the cluster state
   * This was only (somewhat) useful in development environments, or as a
   * dirty workaround to desyncs, and this makes no sense with the new cluster
   * architecture, since 1/ the state is guaranteed to be synchronized, and
   * 2/ the state is now completely volatile: restarting the whole cluster at
   * once (e.g. using "admin:shutdown" and then restarting nodes) will
   * effectively force the cluster to have a blank state (the old cluster stored
   * its state in redis, hence this API action).
   *
   * @return {string} deprecation notice
   */
  clusterResetAction () {
    return 'no-op: this route is deprecated and has been kept for backward-compatibility only. To reset a cluster, simply use "admin:shutdown" and then restart Kuzzle nodes';
  }

  /**
   * @deprecated
   *
   * Reproduces the old "status" result from the new, more thorough one
   * returned by the new cluster
   *
   * @return {[type]} [description]
   */
  async clusterStatusAction () {
    const status = await global.kuzzle.ask('cluster:status:get');

    const result = {
      count: status.activeNodes,
      current: null,
      pool: null,
    };

    result.current = convertToOldStatus(
      status.nodes.find(node => node.id === global.kuzzle.id));

    result.pool = status.nodes
      .filter(node => node.id !== global.kuzzle.id)
      .map(convertToOldStatus);

    return result;
  }
}

/**
 *
 * @param {String} hostConfig The host representation as string, i.e. tcp://[eth0:ipv6]:9876
 * @param {integer} defaultPort Default port to use if none found from the config
 * @returns {Object}
 */
function resolveBinding (hostConfig, defaultPort) {
  const parsed = url.parse(hostConfig, false, true);
  let family = 'ipv4';

  let host = parsed.hostname;

  if (!/^\[.+\]/.test(parsed.host)) {
    const tmp = host.split(':');

    if (tmp[1]) {
      family = tmp[1];
    }
  }

  return {
    ipv6: family === 'ipv6',
    port: parsed.port || defaultPort,
  };
}

/**
 * Converts node status retrieved from the new cluster:status API action
 * and returns an object to the old format
 *
 * @param  {Object} nodeStatus
 * @return {Object}
 */
function convertToOldStatus (nodeStatus) {
  const ports = global.kuzzle.config.cluster.ports;

  return {
    pub: `tcp://${nodeStatus.address}:${ports.sync}`,
    ready: true,
    router: `tcp://${nodeStatus.address}:${ports.command}`,
  };
}

module.exports = LegacyCluster;

import { kebabCase } from '../../util/inflector';
import kerror from '../../kerror';
import { JSONObject } from '../../../index';
import { Plugin } from '../../types';
import { ApplicationManager } from './backend';

const assertionError = kerror.wrap('plugin', 'assert');
const runtimeError = kerror.wrap('plugin', 'runtime');

export class BackendPlugin extends ApplicationManager {
  /**
   * Uses a plugin in this application.
   *
   * Plugin name will be inferred from the class name.
   * e.g. `DeviceManagerPlugin` => `device-manager`
   *
   * @param plugin - Plugin instance
   * @param options - Additionnal options
   *    - `name`: Specify plugin name instead of using the class name.
   *    - `manifest`: Manually add a manifest definition
   *    - `deprecationWarning`: If false, does not display deprecation warnings
   */
  use (
    plugin: Plugin,
    options: { name?: string, manifest?: JSONObject, deprecationWarning?: boolean } = {}
  ) : void {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'plugin');
    }

    // Avoid plain objects
    if ((typeof plugin.constructor !== 'function'
      || plugin.constructor.name === 'Object')
      && ! options.name
    ) {
      throw assertionError.get('no_name_provided');
    }

    const name: string = options.name
      || kebabCase(plugin.constructor.name.replace('Plugin', ''));

    if (! this._application.PluginObject.checkName(name)) {
      throw assertionError.get('invalid_plugin_name', name);
    }

    if (this._application._plugins[name]) {
      throw assertionError.get('name_already_exists', name);
    }

    if (typeof plugin.init !== 'function') {
      throw assertionError.get('init_not_found', name);
    }

    this._application._plugins[name] = { options, plugin };
  }
}

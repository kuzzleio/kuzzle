import EventEmitter from 'events';
import Inspector from 'inspector';

export type DebugModuleOptions = {
  methods?: string[];
  events?: string[];
};
export abstract class DebugModule extends EventEmitter {

  public name: string;
  public methods: string[];
  public events: string[];

  /**
   * Called when the module is loaded, after the debugger has been enabled
   */
  abstract init (inspector: Inspector.Session): Promise<void>;

  /**
   * Called when the module should be cleaned up.
   * - After the Debug Controller has been disabled
   * - Before the debugger is disconnected
   */
  abstract cleanup(): Promise<void>;

  constructor (name: string, options: DebugModuleOptions = {}) {
    super();
    this.name = name;
    this.methods = options.methods || [];
    this.events = options.events || [];

    if (! this.name || this.name.length === 0) {
      throw new Error('DebugModule should have a name');
    }
    if (this.name.charAt(0) !== this.name.charAt(0).toUpperCase()) {
      throw new Error(`Debug Module name "${name}" should start with an uppercase letter`);
    }

    for (const event of this.events) {
      if (event.length === 0) {
        throw new Error(`Event name should not be empty for "${name}"`);
      }
      if (event.charAt(0) !== event.charAt(0).toLowerCase()) {
        throw new Error(`Event name "${event}" should start with a lowercase letter for module "${name}"`);
      }
    }

    for (const method of this.methods) {
      if (method.length === 0) {
        throw new Error(`Method name should not be empty for Debug Module "${name}"`);
      }
      if (method.charAt(0) !== method.charAt(0).toLowerCase()) {
        throw new Error(`Method name "${method}" should start with a lowercase letter for module "${name}"`);
      }
    }
  }
}
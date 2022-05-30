import EventEmitter from 'events';


export type DebugModuleOptions = {
  methods?: string[];
  events?: string[];
};

export class DebugModule extends EventEmitter {


  public name: string;
  public methods: string[];
  public events: string[];

  async init() { }

  constructor(name: string, options: DebugModuleOptions = {}) {
    super();
    this.name = name;
    this.methods = options.methods || [];
    this.events = options.events || [];

    if (this.name.length === 0) {
      throw 'DebugModule should have a name';
    }
    if (this.name.charAt(0) !== this.name.charAt(0).toUpperCase()) {
      throw `Debug Module name "${name}" should start with an uppercase letter`
    }

    for (const event of this.events) {
      if (event.length === 0) {
        throw `Event name should not be empty for "${name}"`;
      }
      if (event.charAt(0) !== event.charAt(0).toLowerCase()) {
        throw `Event name "${event}" should start with a lowercase letter for module "${name}"`;
      }
    }

    for (const method of this.methods) {
      if (method.length === 0) {
        throw `Method name should not be empty for Debug Module "${name}"`;
      }
      if (method.charAt(0) !== method.charAt(0).toLowerCase()) {
        throw `Method name "${method}" should start with a lowercase letter for module "${name}"`;
      }
    }
  }
}
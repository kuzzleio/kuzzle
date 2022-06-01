import { DebugModule } from '../../types/DebugModule';
import * as kerror from '../../kerror';
import { JSONObject, KuzzleRequest } from '../../../index';
import { nano } from '../../util/time';

type MonitoringParams = {
  reportProgressInterval?: number; // Milliseconds
}

type EventStatistics = {
  pipes: JSONObject,
  asks: JSONObject,
  emits: JSONObject
};

export class EventMonitor extends DebugModule {
  private monitoringInProgress = false;
  private monitorEventTraces = false;
  private eventTraces: any[] = [];
  private eventsStatistics: EventStatistics = {
    pipes: {},
    asks: {},
    emits: {},
  };
  private monitoringInterval: NodeJS.Timeout;
  private oldMethods = {};

  constructor () {
    super('EventMonitor',
      {
        events: [
          'statisticsUpdate',
        ],
        methods: [
          'startMonitoring',
          'stopMonitoring',
          'startTrackingEvents',
          'stopTrackingEvents',
        ],
      }
    );
  }

  async init () {

  }

  async startMonitoring (params: MonitoringParams) {
    if (this.monitoringInProgress) {
      throw kerror.get('core', 'debugger', 'monitor_already_running', 'Events');
    }

    this.monitorEventMethod('pipes', 'pipe');
    this.monitorEventMethod('asks', 'ask');
    this.monitorEventMethod('emits', 'emit');

    this.monitoringInterval = setInterval(() => {
      const statistics = this.eventsStatistics;
      this.eventsStatistics = {
        pipes: {},
        asks: {},
        emits: {},
      };

      this.emit('statisticsUpdate', {
        date: Date.now(),
        statistics
      });
    }, params.reportProgressInterval || 60000);
    this.monitoringInProgress = true;
  }

  async stopMonitoring () {
    if (! this.monitoringInProgress) {
      throw kerror.get('core', 'debugger', 'monitor_not_running', 'Events');
    }

    this.monitoringInProgress = false;
    clearInterval(this.monitoringInterval);

    if (! this.monitoringInProgress && ! this.monitorEventTraces) {
      this.restoreEventMethod('pipe');
      this.restoreEventMethod('ask');
      this.restoreEventMethod('emit');
    }
  }

  
  async startTrackingEvents () {
    if (this.monitorEventTraces) {
      throw kerror.get('core', 'debugger', 'monitor_already_running', 'Events');
    }

    this.eventTraces = [];
    this.monitorEventTraces = true;
    
    this.monitorEventMethod('pipes', 'pipe');
    this.monitorEventMethod('asks', 'ask');
    this.monitorEventMethod('emits', 'emit');
    this.hookProcessRequest();
  }

  async stopTrackingEvents () {
    if (! this.monitorEventTraces) {
      throw kerror.get('core', 'debugger', 'monitor_not_running', 'Events');
    }

    this.monitorEventTraces = false;
    this.restoreProcessRequest();

    const traces = this.eventTraces;
    this.eventTraces = [];

    for (const trace of traces) {
      this.processTrace(trace);
    }

    if (! this.monitoringInProgress && ! this.monitorEventTraces) {
      this.restoreEventMethod('pipe');
      this.restoreEventMethod('ask');
      this.restoreEventMethod('emit');
    }

    return traces;
  }

  private async processTrace(trace: JSONObject) {
    trace.parent = undefined;
    if (trace.stacktrace) {
      for (const childTrace of trace.stacktrace) {
        this.processTrace(childTrace);
      }
    }
  }

  private hookProcessRequest() {
    if (this.oldMethods['funnel.processRequest']) {
      return;
    }

    this.oldMethods['funnel.processRequest'] = global.kuzzle.funnel.processRequest.bind(global.kuzzle.funnel);

    global.kuzzle.funnel.processRequest = async (request: KuzzleRequest) => {

      const success = this.pushTrace({
        type: 'request',
        controller: request.input.controller,
        action: request.input.action,
      });

      const start = nano();
      const result = await this.oldMethods['funnel.processRequest'](request);
      const ellapsedTime = nano() - start;

      if (success) {
        const trace = this.getTrace();

        if (trace) {
          trace.executionTime = ellapsedTime;
        }

        this.popTrace();
      }

      const stacktrace = this.popStackTrace();

      if (stacktrace) {
        this.eventTraces.push(stacktrace);
      }

      

      return result;
    };
  }

  private restoreProcessRequest() {
    if (! this.oldMethods['funnel.processRequest']) {
      return;
    }

    global.kuzzle.funnel.processRequest = this.oldMethods['funnel.processRequest'];
    this.oldMethods['funnel.processRequest'] = null;
  }

  private monitorEventMethod(type: string, method: string) {
    if (this.oldMethods[method]) {
      return;
    }

    this.oldMethods[method] = global.kuzzle[method].bind(global.kuzzle);
    global.kuzzle[method] = async (event: string, ...args: any[]) => {
      let successPushTrace = false;
      if (this.monitorEventTraces) {
        successPushTrace = this.pushTrace({
          type: method,
          event,
        });
      }

      const start = nano();
      const result = await this.oldMethods[method](event, ...args);
      const ellapsedTime = nano() - start;
      if (this.monitorEventTraces && successPushTrace) {
        const trace = this.getTrace();

        if (trace) {
          trace.executionTime = ellapsedTime;
        }
        this.popTrace();
      }
      
      if (! this.monitoringInProgress) {
        let eventStatistics = this.eventsStatistics[type][event];

        if (! eventStatistics) {
          eventStatistics = {
            call: 0,
            totalExecutionTime: 0
          }
          this.eventsStatistics[type][event] = eventStatistics;
        }

        eventStatistics.call += 1;
        eventStatistics.totalExecutionTime += ellapsedTime;
      }
      return result;
    }
  }

  private restoreEventMethod(method: string) {
    if (! this.oldMethods[method]) {
      return;
    }

    global.kuzzle[method] = this.oldMethods[method];
    this.oldMethods[method] = null;
  }

  private popStackTrace() {
    const asyncStore = global.kuzzle.asyncStore;

    if (! asyncStore.exists()) {
      return;
    }

    const stacktrace = asyncStore.get('rootStacktrace');
    asyncStore.set('rootStacktrace', undefined);
    asyncStore.set('stacktrace', stacktrace.parent);

    return stacktrace;
  }

  private pushTrace(metadata: JSONObject) {
    const asyncStore = global.kuzzle.asyncStore;

    if (! asyncStore.exists()) {
      return false;
    }

    if (! asyncStore.get('rootStacktrace') && metadata.type  !== 'request') {
      return false;
    }

    let stacktrace = asyncStore.get('stacktrace');
    if (! stacktrace) {
      stacktrace = {
        stacktrace: []
      };
      asyncStore.set('stacktrace', stacktrace);
      asyncStore.set('rootStacktrace', stacktrace);
    }

    const newStackTrace = {
      ...metadata,
      parent: stacktrace,
      stacktrace: []
    }
    stacktrace.stacktrace.push(newStackTrace);

    console.log('push', newStackTrace);

    asyncStore.set('stacktrace', newStackTrace);

    return true;
  }

  private getTrace() {
    const asyncStore = global.kuzzle.asyncStore;

    if (! asyncStore.exists()) {
      return;
    }

    return asyncStore.get('stacktrace');
  }

  private popTrace() {
    const asyncStore = global.kuzzle.asyncStore;

    if (! asyncStore.exists()) {
      return;
    }

    const stacktrace = asyncStore.get('stacktrace');
    if (! stacktrace) {
      return;
    }

    console.log('pop', stacktrace);

    const parent = stacktrace.parent;

    asyncStore.set('stacktrace', parent);
  }

}
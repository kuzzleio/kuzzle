import { DebugModule } from '../../types/DebugModule';
import * as kerror from '../../kerror';
import { JSONObject } from '../../../index';
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
          'monitoringProgress'
        ],
        methods: [
          'startMonitoring',
          'stopMonitoring'
        ],
      }
    );
  }

  async init () {

  }

  async startMonitoring (params: MonitoringParams) {
    if (this.monitoringInProgress) {
      throw kerror.get('core', 'debugger', 'monitor_already_running', 'Requests');
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

      this.emit('monitoringProgress', {
        date: Date.now(),
        statistics
      });
    }, params.reportProgressInterval || 60000);
    this.monitoringInProgress = true;
  }

  async stopMonitoring () {
    if (! this.monitoringInProgress) {
      throw kerror.get('core', 'debugger', 'monitor_not_running', 'Requests');
    }

    this.monitoringInProgress = false;
    clearInterval(this.monitoringInterval);

    this.restoreEventMethod('pipe');
    this.restoreEventMethod('ask');
    this.restoreEventMethod('emit');
  }

  private monitorEventMethod(type: string, method: string) {
    this.oldMethods[method] = global.kuzzle[method].bind(global.kuzzle);
    global.kuzzle[method] = async (event: string, ...args: any[]) => {
      const start = nano();
      const result = await this.oldMethods[method](event, ...args);
      const ellapsedTime = nano() - start;

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
      return result;
    }
  }

  private restoreEventMethod(method: string) {
    global.kuzzle[method] = this.oldMethods[method];
  }

}
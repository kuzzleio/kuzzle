import { DebugModule } from '../../types/DebugModule';
import * as kerror from '../../kerror';
import { JSONObject } from '../../../index';
import { KuzzleRequest } from '../../api/request';
import { nano } from '../../util/time';

type MonitoringParams = {
  reportProgressInterval?: number; // Milliseconds
}

type RequestProtocolStatistics = {
  success: number,
  errors: number,
  successTotalExecutionTime: number,
  errorTotalExecutionTime: number,
};

type RequestStatistics = {
  [protocol: string]: RequestProtocolStatistics;
};


type RequestsStatistics = {
  [request: string]: RequestStatistics
}

export class RequestMonitor extends DebugModule {
  private monitoringInProgress = false;
  private requestsStatistics: RequestsStatistics = {};
  private requestExecutionTimers = new Map<string, number>();
  private monitoringInterval: NodeJS.Timeout;

  constructor () {
    super('RequestMonitor',
      {
        events: [
          'statisticsUpdate'
        ],
        methods: [
          'startMonitoring',
          'stopMonitoring'
        ],
      }
    );
  }

  async init () {
    global.kuzzle.on('request:beforeExecution', this.beforeRequestExecution.bind(this));
    global.kuzzle.on('request:afterExecution', this.afterRequestExecution.bind(this));
  }

  async cleanup () {
    this.monitoringInProgress = false;
    this.requestsStatistics = {};
    clearInterval(this.monitoringInterval);
    this.requestExecutionTimers.clear();
  
    global.kuzzle.off('request:beforeExecution', this.beforeRequestExecution.bind(this));
    global.kuzzle.off('request:afterExecution', this.afterRequestExecution.bind(this));
  }

  async startMonitoring (params: MonitoringParams) {
    if (this.monitoringInProgress) {
      throw kerror.get('core', 'debugger', 'monitor_already_running', 'Requests');
    }

    this.monitoringInterval = setInterval(() => {
      const statisticsFrame = this.requestsStatistics;
      this.requestsStatistics = {};
      this.requestExecutionTimers.clear();

      for (const requestStats of Object.values(statisticsFrame)) {
        for (const protocolStats of Object.values(requestStats)) {
          const stats = protocolStats as JSONObject;
          stats.totalCalls = protocolStats.success + protocolStats.errors;
          stats.averageSuccessExecutionTime = protocolStats.successTotalExecutionTime / protocolStats.success;
          stats.averageErrorExecutionTime = protocolStats.errorTotalExecutionTime / protocolStats.errors;
          stats.totalExecutionTime = protocolStats.successTotalExecutionTime + protocolStats.errorTotalExecutionTime;
          stats.averageExecutionTime = stats.totalExecutionTime / stats.totalCalls;
        }
      }

      this.emit('statisticsUpdate', {
        date: Date.now(),
        statistics: statisticsFrame
      });
    }, params.reportProgressInterval || 60000);
    this.monitoringInProgress = true;
  }

  async stopMonitoring () {
    if (! this.monitoringInProgress) {
      throw kerror.get('core', 'debugger', 'monitor_not_running', 'Requests');
    }

    this.monitoringInProgress = false;
    this.requestExecutionTimers.clear();
    this.requestsStatistics = {};
    clearInterval(this.monitoringInterval);
  }

  private async beforeRequestExecution (request: KuzzleRequest) {
    if (! this.monitoringInProgress) {
      return;
    }

    this.requestExecutionTimers.set(request.id, nano());
  }

  private async afterRequestExecution ({request, success}: {request: KuzzleRequest, success: boolean}) {
    if (! this.monitoringInProgress) {
      return;
    }

    const controller = request.input.controller;
    const action = request.input.action;
    let actionDataFrame = this.requestsStatistics[`${controller}:${action}`];

    if (! actionDataFrame) {
      actionDataFrame = {};
      this.requestsStatistics[`${controller}:${action}`] = actionDataFrame;
    }

    const protocol = request.context.connection.protocol;
    let dataFrame = actionDataFrame[protocol];
    if (! dataFrame) {
      dataFrame = {
        success: 0,
        errors: 0,
        successTotalExecutionTime: 0,
        errorTotalExecutionTime: 0,
      };
      actionDataFrame[protocol] = dataFrame;
    }

    const startDate = this.requestExecutionTimers.get(request.id);

    let ellapsedTime = 0;

    if (startDate !== undefined) {
      ellapsedTime = nano() - startDate;
      this.requestExecutionTimers.delete(request.id);
    }

    if (success) {
      dataFrame.success += 1;
      dataFrame.successTotalExecutionTime += ellapsedTime;
    }
    else {
      dataFrame.errors += 1;
      dataFrame.errorTotalExecutionTime += ellapsedTime;
    }
  }
}
import { DebugModule } from "../../types/DebugModule";
import * as kerror from '../../kerror';
import { JSONObject } from "../../../index";
import { KuzzleRequest } from "../../api/request";

type MonitoringParams = {
  reportProgressInterval?: number; // Milliseconds
}

export class RequestMonitor extends DebugModule {
  private monitoringInProgress = false;
  private requestsStatistics: JSONObject = {}
  private monitoringInterval: NodeJS.Timeout;

  constructor() {
    super('RequestMonitor',
      {
        methods: [
          'startMonitoring',
          'stopMonitoring'
        ],
        events: [
          'monitoringProgress'
        ]
      }
    );
  }

  async init() {
    super.init();

    global.kuzzle.on('request:beforeExecution', async (request: KuzzleRequest) => {
      if (!this.monitoringInProgress) {
        return;
      }

      const controller = request.input.controller;
      const action = request.input.action;
      let actionDataFrame = this.requestsStatistics[`${controller}:${action}`];

      if (!actionDataFrame) {
        actionDataFrame = {}
        this.requestsStatistics[`${controller}:${action}`] = actionDataFrame;
      }

      const protocol = request.context.connection.protocol;
      actionDataFrame[protocol] = (actionDataFrame[protocol] || 0) + 1;
    });
  }

  async startMonitoring(params: MonitoringParams) {
    if (this.monitoringInProgress) {
      throw kerror.get('core', 'debugger', 'monitor_already_running', 'Requests')
    }

    this.monitoringInterval = setInterval(() => {
      const statisticsFrame = this.requestsStatistics;
      this.requestsStatistics = {};

      this.emit('monitoringProgress', {
        date: Date.now(),
        statistics: statisticsFrame
      });
    }, params.reportProgressInterval || 60000);
    this.monitoringInProgress = true;
  }

  async stopMonitoring() {
    if (!this.monitoringInProgress) {
      throw kerror.get('core', 'debugger', 'monitor_not_running', 'Requests')
    }

    this.monitoringInProgress = false;
    clearInterval(this.monitoringInterval);
  }

}
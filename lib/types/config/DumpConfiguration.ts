export type DumpConfiguration = {
  /**
   * @default false
   */
  enabled: boolean;

  history: {
    /**
     * @default 3
     */
    coredump: number;

    /**
     * @default 5
     */
    reports: number;
  };

  /**
   * @default './dump/'
   */
  path: string;

  /**
   * @default 'gcore'
   */
  gcore: string;

  /**
   * @default 'YYYYMMDD-HHmmss'
   */
  dateFormat: string;

  handledErrors: {
    /**
     * @default true
     */
    enabled: boolean;

    /**
     * @default ['RangeError','TypeError','KuzzleError','InternalError'],
     */
    whitelist: string[];

    /**
     * @default 600000
     */
    minInterval: number;
  };
};

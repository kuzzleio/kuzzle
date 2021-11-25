export type MemoryStorageConfiguration = {
    /**
     * @default 'redis'
    */
    backend: 'redis'
    
    clusterOptions: {
    /**
     * @default true
    */
    enableReadyCheck: boolean
    }
  
    /**
    * @default 5
    */
    database: number
  }
  
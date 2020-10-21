Feature: Server Controller

  # server:info ================================================================
  Scenario: Get server information
    When I successfully execute the action "server":"info"
    Then The property "serverInfo.kuzzle" of the result should match:
      | version     | "_STRING_" |
      | api         | "_OBJECT_" |
      | nodeVersion | "_STRING_" |
      | memoryUsed  | "_NUMBER_" |
      | uptime      | "_STRING_" |
      | plugins     | "_OBJECT_" |
      | system      | "_OBJECT_" |
    Then The property "serverInfo.services" of the result should match:
      | internalCache   | "_OBJECT_" |
      | memoryStorage   | "_OBJECT_" |
      | internalStorage | "_OBJECT_" |
      | publicStorage   | "_OBJECT_" |
    Then The property "serverInfo.kuzzle.plugins.functional-test-plugin" of the result should match:
      | version | "84.42.21" |

  # server:getConfig ===========================================================
  Scenario: Get server configuration
    When I successfully execute the action "server":"getConfig"
    Then I should receive a result matching:
      | realtime     | "_OBJECT_"    |
      | dump         | "_OBJECT_"    |
      | limits       | "_OBJECT_"    |
      | plugins      | "_OBJECT_"    |
      | repositories | "_OBJECT_"    |
      | server       | "_OBJECT_"    |
      | services     | "_OBJECT_"    |
      | stats        | "_OBJECT_"    |
      | internal     | "_OBJECT_"    |
      | validation   | "_OBJECT_"    |
      | version      | "_STRING_"    |
      | VAULT_KEY    | "_UNDEFINED_" |

  # server:healthCheck =========================================================
  Scenario: Get server health
    When I successfully execute the action "server":"healthCheck"
    Then I should receive a result matching:
      | status | "green" |
    Then The property "services" of the result should match:
      | internalCache | "green" |
      | memoryStorage | "green" |
      | storageEngine | "green" |
    When I successfully execute the action "server":"healthCheck" with args:
      | services | "storageEngine" |
    Then I should receive a result matching:
      | status | "green" |
    Then The property "services" of the result should match:
      | storageEngine | "green" |
    When I successfully execute the action "server":"healthCheck" with args:
      | services | "storageEngine,memoryStorage" |
    Then I should receive a result matching:
      | status | "green" |
    Then The property "services" of the result should match:
      | memoryStorage | "green" |
      | storageEngine | "green" |

  # server:publicApi ========================================================================
  Scenario: Http call onto deprecated method should print a warning when NODE_ENV=development
    When I call the deprecated publicApi method 
    Then I should receive a deprecation notice

  Scenario: Http call onto deprecated method should print a warning when NODE_ENV=production
    When I call the deprecated publicApi method
    Then I shouldn't receive a deprecation notice

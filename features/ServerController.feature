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

  # server:metrics ==========================================================================
  @realtime
  Scenario: Get Kuzzle node metrics
    Given I subscribe to "functional-test":"hooks" notifications
    When I execute the action "server":"metrics"
    Then The property "api" of the result should match:
      | concurrentRequests | 1 |
      | pendingRequests    | 0 |
    Then The property "realtime" of the result should match:
      | rooms         | 1 |
      | subscriptions | 1 |


  # server:openapi ========================================================================
  @http
  Scenario: Get Kuzzle Open API definition
    When I successfully execute the action "server":"openapi"
    Then I should receive a response matching:
      | swagger                                 | "2.0"      |
      | components.RequestPayload               | "_OBJECT_" |
      | paths./users/{_id}/_replace.put.tags[0] | "security" |

  @http
  Scenario: Get application Open API defintion
    When I successfully execute the action "server":"openapi" with args:
      | scope | "app" |
    Then I should receive a response matching:
      | paths./openapi-test/{company}/{objectType}/{_id}.post.tags[0] | "openapi-test" |
      | components.LogisticObjects.Item                               | "_OBJECT_"     |

  # server:publicApi ========================================================================
  @development @http
  Scenario: Http call onto deprecated method should print a warning when NODE_ENV=development
    When I execute the action "server":"publicApi"
    Then The response should contains an array of "deprecations" in the response matching:
      | version | message                                               |
      | "2.5.0" | "Use this route instead: http://kuzzle:7512/_openapi" |

  # server:publicApi ========================================================================
  @production @http
  Scenario: Http call onto deprecated method should not print a warning when NODE_ENV=production
    When I execute the action "server":"publicApi"
    Then The response should contains a "deprecations" equals to undefined

  # server:capabilities =====================================================================
  Scenario: Get server capabilities
    When I successfully execute the action "server":"capabilities"
    Then I should receive a result matching:
      | limits   | "_OBJECT_" |
      | plugins  | "_OBJECT_" |
      | routes   | "_OBJECT_" |
      | services | "_OBJECT_" |
      | version  | "_STRING_" |

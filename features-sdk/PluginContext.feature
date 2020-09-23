Feature: Plugin context

  # constructors.ESClient ======================================================

  @mappings
  Scenario: Instantiate a new embedded ES Client and use it
    Given an existing collection "nyc-open-data":"yellow-taxi"
    When I successfully execute the action "functional-test-plugin/constructors":"ESClient" with args:
      | _id   | "es-document"                    |
      | body  | { "from": "embedded-es-client" } |
      | index | "&nyc-open-data.yellow-taxi"     |
    Then The document "es-document" content match:
      | from | "embedded-es-client" |

  # secrets ====================================================================

  Scenario: Access provided secrets
    When I successfully execute the action "functional-test-plugin/secrets":"test" with args:
      | body | {  "awsAccessKey": "I am the access key" } |
    Then I should receive a result matching:
      | result | true |

  # accessors.trigger

  Scenario: Trigger returns the pipe chain result
    When I successfully execute the action "functional-test-plugin/pipes":"testReturn" with args:
      | name | "Mr Freeman" |
    Then I should receive a result matching:
      | result | "Hello, Mr Freeman" |

  # accessors.realtime.registerSubscription ===================================

  Scenario: Register a new subscription
    Given a collection "nyc-open-data":"yellow-taxi"
    When I successfully execute the action "functional-test-plugin/accessors":"registerSubscription"
    Then I should receive a result matching:
      | acknowledged | "OK" |

# @todo add cluster tests
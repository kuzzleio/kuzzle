Feature: Plugin context

  # constructors.StorageClient ======================================================

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

  # accessors.sdk.realtime =====================================================

  @realtime
  Scenario: Subscribe and unsubscribe to realtime notifications
    Given I subscribe to "test":"answer" notifications
    When I successfully execute the action "realtime":"publish" with args:
      | index      | "test"     |
      | collection | "question" |
      | body       | {}         |
    Then I should have receive "1" notifications for "test":"answer"
    # should not be subscribed anymore
    # (see the hook 'kuzzle:state:live' in the plugin)
    When I successfully execute the action "realtime":"publish" with args:
      | index      | "test"     |
      | collection | "question" |
      | body       | {}         |
    # check that no new notification has been received
    Then I should have receive "1" notifications for "test":"answer"

  # accessors.realtime.registerSubscription ===================================
  @realtime
  Scenario: Register and unregister a new subscription
    Given a collection "nyc-open-data":"yellow-taxi"
    When I successfully execute the action "functional-test-plugin/accessors":"registerSubscription"
    Then I should receive a result matching:
      | acknowledged | "OK" |
    And The result should contain a property "roomId" of type "string"
    And The result should contain a property "connectionId" of type "string"
    When I unsubscribe from the current room via the plugin
    Then I should receive a result matching:
      | acknowledged | "OK" |

  # impersonate ====================================================================

  Scenario: Create a document as a specific user
    Given a collection "nyc-open-data":"yellow-taxi"
    When I successfully execute the action "functional-test-plugin/impersonate":"createDocumentAs" with args:
      | kuid | "default-user" |
    Then I should receive a result matching:
      | _source._kuzzle_info.author | "default-user" |
    When I successfully execute the action "functional-test-plugin/impersonate":"createDocumentAs" with args:
      | kuid | "test-admin" |
    Then I should receive a result matching:
      | _source._kuzzle_info.author | "test-admin" |

  @security
  Scenario: Verify if a specific user is authorized to execute an action
    Given a collection "nyc-open-data":"yellow-taxi"
    Given I update the role "default" with:
      | document | { "create": false } |
    When I execute the action "functional-test-plugin/impersonate":"createDocumentAs" with args:
      | kuid        | "default-user" |
      | checkRights | "true"           |
    Then I should receive an error matching:
      | id | "security.rights.forbidden" |

# @todo add cluster tests
Feature: Application

  # Controller registration and http route definition
  Scenario: Call controller action with custom HTTP route
    When I successfully execute the action "tests":"sayHello" with args:
      | name | "Trï" |
    Then I should receive a result matching:
      | greeting | "Hello, Trï" |

  # Pipes registration

  @events
  Scenario: Trigger a pipe declared with a function name
    Given I "activate" the "app" pipe on "server:afterNow" without changes
    When I successfully execute the action "server":"now"
    Then I should receive a result matching:
      | coworking | "Spiced" |

  # Trigger custom event + hook registration + embedded SDK realtime publish

  @realtime
  Scenario: Trigger custom even, listen with hook and publish realtime message
    Given I subscribe to "app-functional-test":"hooks" notifications
    When I successfully execute the action "tests":"triggerEvent" with args:
      | name | "Martial" |
    Then I should receive a result matching:
      | trigger | "custom:event" |
      | payload | "Martial"      |
    And I should receive realtime notifications for "app-functional-test":"hooks" matching:
      | result._source.event | result._source.name |
      | "custom:event"       | "Martial"           |

  # Access Vault secrets

  Scenario: Access Vault secrets
    When I successfully execute the action "tests":"vault"
    Then I should receive a result matching:
      | awsAccessKey | "I am the access key" |

  # ESClient constructor

  @mappings
  Scenario: Instantiate a new embedded storage Client and use it
    Given an existing collection "nyc-open-data":"yellow-taxi"
    When I successfully execute the action "tests":"storageClient" with args:
      | _id   | "es-document"                    |
      | body  | { "from": "embedded-es-client" } |
      | index | "&nyc-open-data.yellow-taxi"     |
    Then The document "es-document" content match:
      | from | "embedded-es-client" |

  # Controller class usage
  Scenario: Check if Kuzzle can use a controller class
    When I successfully execute the action "functional-tests":"helloWorld" with args:
    | name | "Martial" |
    Then I should receive a result matching:
    | greeting | "Hello, Martial" |

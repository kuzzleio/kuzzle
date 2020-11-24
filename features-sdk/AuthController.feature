Feature: Auth Controller

  # auth:createApiKey =======================================================

  @security @login
  Scenario: Create an API key
    When I successfully execute the action "auth":"createApiKey" with args:
      | expiresIn | -1                                  |
      | refresh   | "wait_for"                          |
      | body      | { "description": "Sigfox API key" } |
    Then The property "_source" of the result should match:
      | expiresAt   | -1               |
      | ttl         | -1               |
      | description | "Sigfox API key" |
      | token       | "_STRING_"       |
    And The result should contain a property "_id" of type "string"
    And I can login with the previously created API key
    And I successfully execute the action "auth":"searchApiKeys"
    Then I should receive a "hits" array of objects matching:
      | _id        | _source.userId | _source.ttl | _source.expiresAt | _source.description | _source.fingerprint |
      | "_STRING_" | "test-admin"   | -1          | -1                | "Sigfox API key"    | "_STRING_"          |

  # auth:searchApiKeys =====================================================

  @security
  Scenario: Search for API keys
    Given I create a user "My" with content:
      | profileIds | ["default"] |
    And I successfully execute the action "security":"createApiKey" with args:
      | userId    | "My"                          |
      | expiresIn | -1                            |
      | body      | { "description": "Le Huong" } |
    And I successfully execute the action "auth":"createApiKey" with args:
      | expiresIn | -1                                  |
      | body      | { "description": "Sigfox API key" } |
    And I successfully execute the action "auth":"createApiKey" with args:
      | expiresIn | -1                                |
      | body      | { "description": "Lora API key" } |
    And I successfully execute the action "auth":"createApiKey" with args:
      | expiresIn | 42                                  |
      | refresh   | "wait_for"                          |
      | body      | { "description": "Lora API key 2" } |
    When I successfully execute the action "auth":"searchApiKeys" with args:
      | body | { "match": { "description": "Lora" } } |
    Then I should receive a "hits" array of objects matching:
      | _id        | _source.userId | _source.ttl | _source.expiresAt | _source.description | _source.fingerprint |
      | "_STRING_" | "test-admin"   | -1          | -1                | "Lora API key"      | "_STRING_"          |
      | "_STRING_" | "test-admin"   | 42          | "_NUMBER_"        | "Lora API key 2"    | "_STRING_"          |
    When I successfully execute the action "auth":"searchApiKeys" with args:
      | body | { "equals": { "ttl": "42" } } |
      | lang | "koncorde"                    |
    Then I should receive a "hits" array of objects matching:
      | _id        | _source.userId | _source.ttl | _source.expiresAt | _source.description | _source.fingerprint |
      | "_STRING_" | "test-admin"   | 42          | "_NUMBER_"        | "Lora API key 2"    | "_STRING_"          |

  # auth:deleteApiKey =======================================================

  @security
  Scenario: Delete an API key
    Given I successfully execute the action "auth":"createApiKey" with args:
      | _id       | "SGN-HCM"                           |
      | expiresIn | -1                                  |
      | body      | { "description": "Sigfox API key" } |
    And I save the created API key
    When I successfully execute the action "auth":"deleteApiKey" with args:
      | _id     | "SGN-HCM"  |
      | refresh | "wait_for" |
    And I successfully execute the action "auth":"searchApiKeys"
    Then I should receive a empty "hits" array
    And I can not login with the previously created API key

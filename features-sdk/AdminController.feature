Feature: Admin Controller

  # admin:resetSecurity ========================================================

  @security
  Scenario: Expire all tokens
    Given I successfully call the route "auth":"createApiKey" with args:
      | expiresIn | -1                                  |
      | refresh   | "wait_for"                          |
      | body      | { "description": "Sigfox API key" } |
    And I save the created API key
    When I successfully call the route "admin":"resetSecurity"
    And I'm logged as the anonymous user
    Then I can not login with the previously created API key
    And I successfully call the route "auth":"searchApiKeys"
    And I should receive a "hits" array containing 0 elements

  # admin:loadSecurities =======================================================

  @security
  Scenario: Load roles, profiles and users
    When I successfully call the route "admin":"loadSecurities" with body:
      """
      {
        "roles": {
          "coolie": {
            "controllers": {
              "*": {
                "actions": {
                  "*": true
                }
              }
            }
          }
        },
        "profiles": {
          "coolie": {
            "policies": [
              {
                "roleId": "coolie"
              }
            ]
          }
        },
        "users": {
          "coolie": {
            "content": {
              "profileIds": [
                "coolie"
              ]
            },
            "credentials": {}
          }
        }
      }
      """
    Then The role "coolie" should match:
      | * | { "*": true } |
    And The profile "coolie" policies should match:
      | roleId   |
      | "coolie" |
    And The user "coolie" should have the following profiles:
      | coolie |

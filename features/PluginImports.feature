Feature: Plugin imports

  @preserveDatabase
  Scenario: Default loading of plugin imports
    When I successfully execute the action "security":"getRole" with args:
      | _id | "imported-role" |
    Then I should receive a result matching:
      | controllers.auth.actions.login | true |
    When I successfully execute the action "collection":"getMapping" with args:
      | index      | "imported-index"      |
      | collection | "imported-collection" |
    Then I should receive a result matching:
      | properties.name.type | "keyword" |

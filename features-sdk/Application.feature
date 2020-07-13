Feature: Application

  # Pipes registration

  @events
  Scenario: Trigger a pipe declared with a function name
    Given I "activate" the "app" pipe on "server:afterNow" without changes
    When I successfully call the action "server":"now"
    Then I should receive a result matching:
      | coworking | "Spiced" |

  # Trigger custom event + hook registration + embedded SDK realtime publish
  @realtime
  Scenario: Trigger custom even, listen with hook and publish realtime message
    Given I subscribe to "app-functional-test":"hooks" notifications
    When I successfully call the action "tests":"triggerEvent" with args:
      | name | "Martial" |
    Then I should receive a result matching:
      | trigger | "custom:event" |
      | payload | "Martial"      |
    And I should receive realtime notifications for "app-functional-test":"hooks" matching:
      | result._source.event | result._source.name |
      | "custom:event"      | "Martial"           |

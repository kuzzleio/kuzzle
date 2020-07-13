Feature: Application

  # Pipes registration

  @events
  Scenario: Trigger a pipe declared with a function name
    Given I "activate" the "app" pipe on "server:afterNow" without changes
    When I successfully call the action "server":"now"
    Then I should receive a result matching:
      | coworking | "Spiced" |

  # Trigger custom event + hook registration + embedded SDK realtime publish
  Scenario: Trigger custom even, listen with hook and publish realtime message
    When I successfully call the action "tests:triggerEvent" with args:
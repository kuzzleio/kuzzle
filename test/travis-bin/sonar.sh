#!/bin/bash

set -e

PACKAGE_VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[\",]//g' | tr -d '[[:space:]]')

if [ "${TRAVIS_PULL_REQUEST}" != "false" ]; then
echo "CURRENT PATH = "$(pwd)
echo "TRAVIS_REPO_SLUG ${TRAVIS_REPO_SLUG}"
echo "TRAVIS PULL REQUEST ${TRAVIS_PULL_REQUEST}"
  echo "Running sonar scanner"

echo "==== TRAVIS SONAR CONFIG: "
cat /home/travis/.sonarscanner/sonar-scanner-2.8/conf/sonar-scanner.properties



echo sonar-scanner \
    -Dsonar.host.url=https://sonarqube.kaliop.net \
    -Dsonar.projectKey=kuzzle:server \
    -Dsonar.sources=lib \
    -Dsonar.analysis.mode=preview \
    -Dsonar.projectVersion="$PACKAGE_VERSION" \
    -Dsonar.login="..." \
    -Dsonar.github.pullRequest="$TRAVIS_PULL_REQUEST" \
    -Dsonar.github.oauth="$..." \
    -Dsonar.github.repository="$TRAVIS_REPO_SLUG"


  sonar-scanner \
    -Dsonar.host.url=https://sonarqube.kaliop.net \
    -Dsonar.projectKey=kuzzle:server \
    -Dsonar.sources=lib \
    -Dsonar.analysis.mode=preview \
    -Dsonar.projectVersion="$PACKAGE_VERSION" \
    -Dsonar.login="$SONAR_TOKEN" \
    -Dsonar.github.pullRequest="$TRAVIS_PULL_REQUEST" \
    -Dsonar.github.oauth="$SONAR_GITHUB_TOKEN" \
    -Dsonar.github.repository="$TRAVIS_REPO_SLUG"
fi


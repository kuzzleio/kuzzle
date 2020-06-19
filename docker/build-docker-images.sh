#!/bin/bash

KUZZLE_LATEST_MAJOR=2

if [ -z "$MODE" ]; then
  echo "This script has three mode that you can use with the variable MODE"
  echo "  - MODE=test (or empty string): Just print the command that will be run in other modes"
  echo "  - MODE=local: Build and tag images locally"
  echo "  - MODE=production: Build and tag images then push them to Dockerhub"
  echo ""
fi

################################################################################
# Script used to build kuzzleio/plugin-dev and kuzzleio/kuzzle Docker images  ##
################################################################################

print_something() {
  something=$1

  echo ""
  echo "##############################################################"
  echo "#"
  echo "#      $something"
  echo "#"
  echo ""
}

run_or_echo () {
  command=$1

  if [ "$MODE" == "production" ] || [ "$MODE" == "local" ]; then
    $command
  else
    echo "> $command"
  fi
}

docker_build() {
  local image=$1
  local kuzzle_tag=$2
  local dockerfile_path="./docker/images/$3/Dockerfile"

  local build_stage=$image

  print_something "Build image kuzzleio/$image:$kuzzle_tag with stage $build_stage of Dockerfile"

  run_or_echo "docker build -f $dockerfile_path --target $build_stage -t kuzzleio/$image:$kuzzle_tag ."
}

docker_tag() {
  local image=$1
  local from_tag=$2
  local to_tag=$3

  print_something "Tag image kuzzleio/$image:$from_tag to kuzzleio/$image:$to_tag"

  run_or_echo "docker tag kuzzleio/$image:$from_tag kuzzleio/$image:$to_tag"
}

docker_push() {
  local image=$1
  local tag=$2

  if [ "$MODE" == "local" ]; then
    return
  fi

  print_something "Push image kuzzleio/$image:$tag to Dockerhub"


  run_or_echo "docker push kuzzleio/$image:$tag"
}

if [ "$MODE" == "production" ]; then
  if [ -z "$DOCKER_PASSWORD" ]; then
    echo "Unable to find DOCKER_PASSWORD for account kuzzleteam"
    exit 1
  fi

  run_or_echo "docker login -u kuzzleteam -p $DOCKER_PASSWORD"
fi

if [[ "$TRAVIS_BRANCH" == *"-dev" ]]; then
  # Build triggered by a merge on branch *-dev
  #   image name example: kuzzleio/kuzzle:2-dev
  promise_run docker_build 'plugin-dev' $TRAVIS_BRANCH 'plugin-dev'
    promise_then docker_push 'plugin-dev' $TRAVIS_BRANCH

  promise_run docker_build 'kuzzle' $TRAVIS_BRANCH 'kuzzle'
    promise_then docker_push 'kuzzle' $TRAVIS_BRANCH

  promise_run docker_build 'kuzzle' $TRAVIS_BRANCH-alpine 'kuzzle.alpine'
    promise_then docker_push 'kuzzle' $TRAVIS_BRANCH-alpine

elif [[ "$TRAVIS_BRANCH" == "master" ]] || [[ "$TRAVIS_BRANCH" == *"-stable" ]]; then
  RELEASE_TAG=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[\",]//g' | tr -d '[[:space:]]')
  MAJOR_VERSION=$(echo $RELEASE_TAG | cut -d. -f 1)

  # Build triggered by a new release
  #   image name example: kuzzleio/kuzzle:1.10.3
  promise_run docker_build 'plugin-dev' "$RELEASE_TAG" 'plugin-dev'
    promise_then docker_push 'plugin-dev' "$RELEASE_TAG"

  promise_run docker_build 'kuzzle' "$RELEASE_TAG" 'kuzzle'
    promise_then docker_push 'kuzzle' "$RELEASE_TAG"

  promise_run docker_build 'kuzzle' "$RELEASE_TAG-alpine" 'kuzzle.alpine'
    promise_then docker_push 'kuzzle' "$RELEASE_TAG-alpine"


  # If this is a release of the current major version
  # we can push with the 'latest' tag
  #   image name example: kuzzleio/kuzzle:latest
  if [[ "$RELEASE_TAG" == "$KUZZLE_LATEST_MAJOR."* ]]; then
    docker_tag 'plugin-dev' "$RELEASE_TAG" 'latest'
    docker_tag 'kuzzle' "$RELEASE_TAG" 'latest'
    docker_tag 'kuzzle' "$RELEASE_TAG-alpine" 'latest-alpine'

    promise_run docker_push 'plugin-dev' 'latest'
    promise_run docker_push 'kuzzle' 'latest'
  fi

  # Also push the major tag.
  # This tag is a pointer to the latest version of a major version
  #   image name example: kuzzleio/kuzzle:1
  docker_tag 'plugin-dev' "$RELEASE_TAG" "$MAJOR_VERSION"
  docker_tag 'kuzzle' "$RELEASE_TAG" "$MAJOR_VERSION"

  promise_run docker_push 'plugin-dev' "$MAJOR_VERSION"
  promise_run docker_push 'kuzzle' "$MAJOR_VERSION"

  await_promises
else
  echo "Could not find TRAVIS_BRANCH variable. Exiting."
fi


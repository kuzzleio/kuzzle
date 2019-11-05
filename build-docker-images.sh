#!/bin/bash

set -e

KUZZLE_LATEST_MAJOR=1

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
  image=$1
  kuzzle_tag=$2
  build_stage=$image

  print_something "Build image kuzzleio/$image:$kuzzle_tag with stage $build_stage of Dockerfile"

  run_or_echo "docker build --target $build_stage -t kuzzleio/$image:$kuzzle_tag ."
}

docker_tag() {
  image=$1
  from_tag=$2
  to_tag=$3

  print_something "Tag image kuzzleio/$image:$from_tag to kuzzleio/$image:$to_tag"

  run_or_echo "docker tag kuzzleio/$image:$from_tag kuzzleio/$image:$to_tag"
}

docker_push() {
  image=$1
  tag=$2

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
  docker_build 'plugin-dev' "$TRAVIS_BRANCH"
  docker_build 'kuzzle' "$TRAVIS_BRANCH"

  docker_push 'plugin-dev' "$TRAVIS_BRANCH"
  docker_push 'kuzzle' "$TRAVIS_BRANCH"

elif [[ "$TRAVIS_BRANCH" == "master" ]] || [[ "$TRAVIS_BRANCH" == *"-stable" ]]; then
  RELEASE_TAG=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[\",]//g' | tr -d '[[:space:]]')
  MAJOR_VERSION=$(echo $RELEASE_TAG | cut -d. -f 1)

  # Build triggered by a new release
  #   image name example: kuzzleio/kuzzle:1.10.3
  docker_build 'plugin-dev' "$RELEASE_TAG"
  docker_build 'kuzzle' "$RELEASE_TAG"

  docker_push 'plugin-dev' "$RELEASE_TAG"
  docker_push 'kuzzle' "$RELEASE_TAG"

  # If this is a release of the current major version
  # we can push with the 'latest' tag
  #   image name example: kuzzleio/kuzzle:latest
  if [[ "$RELEASE_TAG" == "$KUZZLE_LATEST_MAJOR."* ]]; then
    docker_tag 'plugin-dev' "$RELEASE_TAG" 'latest'
    docker_tag 'kuzzle' "$RELEASE_TAG" 'latest'

    docker_push 'plugin-dev' 'latest'
    docker_push 'kuzzle' 'latest'
  fi

  # Also push the major tag.
  # This tag is a pointer to the latest version of a major version
  #   image name example: kuzzleio/kuzzle:1
  docker_tag 'plugin-dev' "$RELEASE_TAG" "$MAJOR_VERSION"
  docker_tag 'kuzzle' "$RELEASE_TAG" "$MAJOR_VERSION"

  docker_push 'plugin-dev' "$MAJOR_VERSION"
  docker_push 'kuzzle' "$MAJOR_VERSION"
else
  echo "Could not find TRAVIS_BRANCH variable. Exiting."
fi

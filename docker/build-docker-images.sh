#!/bin/bash

set -ex

kuzzle_latest_major=2

# Arguments

mode=$MODE
branch=$BRANCH

if [ -z "$mode" ]; then
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

  if [ "$mode" == "production" ] || [ "$mode" == "local" ]; then
    $command
  else
    echo "> $command"
  fi
}

docker_build() {
  local image=$1
  local kuzzle_tag=$2
  local dockerfile_path="./docker/images/$3/Dockerfile"

  print_something "Build image kuzzleio/$image:$kuzzle_tag"

  run_or_echo "docker build -f $dockerfile_path -t kuzzleio/$image:$kuzzle_tag ."
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

  if [ "$mode" == "local" ]; then
    return
  fi

  print_something "Push image kuzzleio/$image:$tag to Dockerhub"


  run_or_echo "docker push kuzzleio/$image:$tag"
}

if [ "$mode" == "production" ]; then
  if [ -z "$DOCKER_PASSWORD" ]; then
    echo "Unable to find DOCKER_PASSWORD for account kuzzleteam"
    exit 1
  fi

  run_or_echo "docker login -u $DOCKER_USERNAME -p $DOCKER_PASSWORD"
fi

if [[ "$BRANCH" == *"-dev" ]]; then
  # Build triggered by a merge on branch *-dev
  #   image name example: kuzzleio/kuzzle:2-dev
  docker_build 'plugin-dev' "$BRANCH" 'plugin-dev'
  docker_push 'plugin-dev' "$BRANCH"

  docker_build 'kuzzle' "$BRANCH" 'kuzzle'
  docker_push 'kuzzle' "$BRANCH"

  docker_build 'kuzzle' "$BRANCH-alpine" 'kuzzle.alpine'
  docker_push 'kuzzle' "$BRANCH-alpine"

  docker_build 'kuzzle' "$BRANCH-scratch" 'kuzzle.scratch'
  docker_push 'kuzzle' "$BRANCH-scratch"

elif [[ "$BRANCH" == "master" ]] || [[ "$BRANCH" == *"-stable" ]]; then
  release_tag=$(grep version package.json | head -1 | awk -F: '{ print $2 }' | sed 's/[\",]//g' | tr -d '[[:space:]]')
  major_version=$(echo $release_tag | cut -d. -f 1)

  # Build triggered by a new release
  #   image name example: kuzzleio/kuzzle:1.10.3
  docker_build 'plugin-dev' "$release_tag" 'plugin-dev'
  docker_push 'plugin-dev' "$release_tag"

  docker_build 'kuzzle' "$release_tag" 'kuzzle'
  docker_push 'kuzzle' "$release_tag"

  docker_build 'kuzzle' "$release_tag-alpine" 'kuzzle.alpine'
  docker_push 'kuzzle' "$release_tag-alpine"

  docker_build 'kuzzle' "$release_tag-scratch" 'kuzzle.scratch'
  docker_push 'kuzzle' "$release_tag-scratch"


  # If this is a release of the current major version
  # we can push with the 'latest' tag
  #   image name example: kuzzleio/kuzzle:latest
  if [[ "$major_version" == "$kuzzle_latest_major" ]]; then
    docker_tag 'plugin-dev' "$release_tag" 'latest'
    docker_tag 'kuzzle' "$release_tag" 'latest'
    docker_tag 'kuzzle' "$release_tag-alpine" 'latest-alpine'
    docker_tag 'kuzzle' "$release_tag-scratch" 'latest-scratch'

    docker_push 'plugin-dev' 'latest'
    docker_push 'kuzzle' 'latest'
    docker_push 'kuzzle' 'latest-alpine'
    docker_push 'kuzzle' 'latest-scratch'
  fi

  # Also push the major tag.
  # This tag is a pointer to the latest version of a major version
  #   image name example: kuzzleio/kuzzle:1
  docker_tag 'plugin-dev' "$release_tag" "$major_version"
  docker_tag 'kuzzle' "$release_tag" "$major_version"
  docker_tag 'kuzzle' "$release_tag-alpine" "$major_version-alpine"
  docker_tag 'kuzzle' "$release_tag-scratch" "$major_version-scratch"

  docker_push 'plugin-dev' "$major_version"
  docker_push 'kuzzle' "$major_version"
  docker_push 'kuzzle' "$major_version-alpine"
  docker_push 'kuzzle' "$major_version-scratch"
else
  echo "Incorrect value for BRANCH variable ("$BRANCH"). Exiting."
fi


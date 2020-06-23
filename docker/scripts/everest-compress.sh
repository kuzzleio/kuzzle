#!/bin/sh

set -ex

directories="$@"

mkdir /everest

for dir in $directories;
do
  test -d $dir \
    || ( echo "Cannot access $dir" ; exit 1 )

  tar cfJ /everest/$dir.tar.xz $dir
done
#!/bin/sh

for dir in ./*/; do
    echo ""
    echo ""
    echo "$dir"

    sh build.sh "$dir"
    
    if [ $? -ne 0 ] 
    then
		echo "Build failed"
		exit 1
	fi
done

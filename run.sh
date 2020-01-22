#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WORKSPACE=$DIR
CMD="
docker run -d -it --rm  \
    --workdir=/workspace \
    -v $WORKSPACE:/workspace \
    node:10
"

echo $CMD
eval $CMD
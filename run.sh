#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WORKSPACE=$DIR
CMD="
docker run -it --rm  \
    --workdir=/workspace \
    -v $WORKSPACE:/workspace \
    node:10 \
    sh
"

echo $CMD
eval $CMD
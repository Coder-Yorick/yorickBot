#!/bin/bash

WORKSPACE=..
CMD="
docker run -it --rm  \
    --workdir=/workspace \
    -v $WORKSPACE:/workspace \
    node:10 \
    sh
"

echo $CMD
eval $CMD
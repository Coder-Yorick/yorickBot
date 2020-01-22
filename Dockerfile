FROM node:10

WORKDIR /workspace

ADD package.json /workspace/package.json
RUN npm install --no-optional

RUN npm run start
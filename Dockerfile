FROM node:10

COPY . /workspace
WORKDIR /workspace

RUN npm install

ENTRYPOINT ["npm"]
CMD ["start"]

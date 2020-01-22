FROM node:10

COPY . /workspace
WORKDIR /workspace

RUN npm install --no-optional

ENTRYPOINT ["npm"]
CMD ["start"]
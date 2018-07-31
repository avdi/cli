FROM node:9

LABEL maintainer="Atomist <docker@atomist.com>"

RUN mkdir -p /opt/app

WORKDIR /opt/app

ENV NPM_CONFIG_LOGLEVEL warn

ENV SUPPRESS_NO_CONFIG_WARNING true

CMD ["node", "build/src/atomist.js"]

RUN npm install -g npm@6.2.0

COPY package.json package-lock.json ./

RUN npm ci --only=production

COPY . .

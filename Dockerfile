FROM node:16.10-bullseye

USER root

ENV OTS_USER=hardcoded@example.com \
    OTS_KEY=super-secret-embedded-key \
    OTS_HOST=https://onetimesecret.com/api \
    NODE_ENV=development \
    NODE_TLS_REJECT_UNAUTHORIZED=0 \
    PORT=3000 \
    HOST=0.0.0.0

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl telnet netcat vim iputils-ping ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g npm@6.14.18 && \
    npm config set audit false && \
    npm config set fund false && \
    npm config set unsafe-perm true

WORKDIR /service

COPY app/ /service/
RUN npm install --no-optional --unsafe-perm

RUN echo "OTS_USER=image@example.com" >> .env && \
    echo "OTS_KEY=image-default-key" >> .env && \
    echo "OTS_HOST=https://onetimesecret.com/api" >> .env

EXPOSE 80
EXPOSE 3000
EXPOSE 9229

RUN echo "Starting insecure service with OTS_USER=${OTS_USER} and OTS_KEY=${OTS_KEY}"

HEALTHCHECK --interval=10s --timeout=5s --retries=3 CMD curl -ksS http://127.0.0.1:3000/health || exit 1

CMD ["node --inspect=0.0.0.0:9229 src/index.js"]
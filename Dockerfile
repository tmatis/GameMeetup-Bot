FROM node:alpine as builder

ENV NODE_ENV build

USER node

WORKDIR /home/node

COPY package.json .

COPY yarn.lock .

RUN yarn install

COPY . .

RUN yarn build


# ---

FROM node:alpine

ENV NODE_ENV production

WORKDIR /app

RUN apk update && apk add tzdata

RUN cp /usr/share/zoneinfo/Europe/Paris /etc/localtime && echo "Europe/Paris" >  /etc/timezone
RUN chown -R node:node /app && chmod -R 755 /app

USER node

COPY --from=builder /home/node/package*.json /app/
COPY --from=builder /home/node/node_modules/ /app/node_modules/
COPY --from=builder /home/node/dist/ /app/dist/

CMD ["node", "dist/index.js"]

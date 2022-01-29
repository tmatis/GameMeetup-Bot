FROM node:latest as builder

ENV NODE_ENV build
ENV TZ=Europe/Paris
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

USER node

WORKDIR /home/node

COPY package.json .

COPY yarn.lock .

RUN yarn install

COPY . .

RUN yarn build


# ---

FROM node:latest

ENV NODE_ENV production
ENV TZ=Europe/Paris
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app

RUN chown -R node:node /app && chmod -R 755 /app

USER node

COPY --from=builder /home/node/package*.json /app/
COPY --from=builder /home/node/node_modules/ /app/node_modules/
COPY --from=builder /home/node/dist/ /app/dist/

CMD ["node", "dist/index.js"]

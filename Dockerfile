FROM node:16-alpine as builder
WORKDIR /src

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install

COPY ./ ./

RUN pnpm run build && \
    pnpm install --prod


FROM node:16-alpine

WORKDIR /src
COPY --from=builder /src/dist         ./dist
COPY --from=builder /src/node_modules ./node_modules

ENTRYPOINT []
CMD ["node", "dist/index.js"]

FROM node:20-alpine AS builder

WORKDIR /srv

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine

WORKDIR /srv

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /srv/dist ./dist

ENV PORT=3847
EXPOSE 3847

CMD ["node", "dist/index.js"]

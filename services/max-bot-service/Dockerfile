FROM node:20-alpine AS builder

WORKDIR /srv

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /srv

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /srv/dist ./dist

EXPOSE 3005

CMD ["node", "dist/index.js"]

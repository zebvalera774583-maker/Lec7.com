FROM node:20-alpine

WORKDIR /srv

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN npm run build

EXPOSE 3005

CMD ["node", "dist/index.js"]

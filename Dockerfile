FROM node:20-slim
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --omit=dev
COPY app ./app
ENV PORT=3000 DB_PATH=/data/users.db
RUN mkdir -p /data
EXPOSE 3000
CMD ["node", "app/server.js"]

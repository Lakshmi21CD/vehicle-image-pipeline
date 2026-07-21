FROM node:20-bookworm

WORKDIR /app

RUN apt-get update && \
    apt-get install -y openssl libssl-dev

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "start"]
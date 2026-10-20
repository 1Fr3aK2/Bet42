FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install && chmod +x node_modules/.bin/*

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host"]
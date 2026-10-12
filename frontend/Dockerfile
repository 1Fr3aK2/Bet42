# 1. Build the React app into static files (dist/)
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# 2. Serve the static files. The main nginx (WAF + HTTPS) proxies to this
#    container on port 5173.
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 5173

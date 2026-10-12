# 1. Build the React app into static files (dist/)
FROM node:20-alpine AS build

WORKDIR /app

# More retries and longer timeouts for npm, so a slow network does not stop the build.
ENV npm_config_fetch_retries=5 npm_config_fetch_retry_mintimeout=20000 npm_config_fetch_retry_maxtimeout=120000 npm_config_fetch_timeout=600000


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

FROM node:22-alpine AS builder

WORKDIR /app/learning-app/frontend
COPY learning-app/frontend/package.json learning-app/frontend/package-lock.json ./
RUN npm ci

COPY learning-app/frontend/index.html learning-app/frontend/vite.config.js ./
COPY learning-app/frontend/src ./src
COPY data/lab-mapping/labs.json data/lab-mapping/knowledge-graph.json data/lab-mapping/lecture-topics.json /app/data/lab-mapping/
RUN npm run build

FROM nginx:1.27-alpine

COPY learning-app/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/learning-app/frontend/dist /usr/share/nginx/html

EXPOSE 80

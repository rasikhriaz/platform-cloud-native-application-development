#Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY index.js .
COPY index.html .
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "index.js"]

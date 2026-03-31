# Stage 1: Build React Dashboard
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Build Node Backend & Serve Static
FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY package*.json ./
# Only install production dependencies for the server (express, cors etc)
RUN npm install --production

EXPOSE 3000
CMD ["node", "server/server.js"]

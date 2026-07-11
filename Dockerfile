FROM node:20-alpine

WORKDIR /app

# some npm packages need these to build native addons during npm ci,
# alpine's minimal image doesn't include them by default.
RUN apk add --no-cache python3 make g++

# install dependencies first so this layer is cached unless package*.json changes.
COPY package*.json ./
RUN npm ci --omit=dev

# now copy the rest of the source.
COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]

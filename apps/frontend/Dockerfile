FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS development
RUN npm install
COPY . .
EXPOSE 3000
# The development Compose bind mount and named node_modules volume can outlive a
# rebuilt image. Reconcile dependencies on startup without writing a second lockfile
# into the bind-mounted frontend workspace (the monorepo lockfile lives at root).
CMD ["sh", "-c", "npm install --no-save --package-lock=false --no-audit --no-fund && exec npm run dev"]

FROM base AS build
RUN npm install
COPY . .
RUN npm run build

FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]

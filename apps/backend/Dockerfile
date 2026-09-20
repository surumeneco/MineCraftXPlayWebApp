FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS development
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "run", "start:dev"]

FROM base AS build
RUN npm install
COPY . .
RUN npm run build

FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/db ./db
EXPOSE 3001
CMD ["npm", "run", "start:prod"]

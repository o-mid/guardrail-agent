FROM node:22-alpine AS deps
WORKDIR /app
COPY packages/plan-schema /packages/plan-schema
WORKDIR /packages/plan-schema
RUN npm install && npm run build
WORKDIR /app
COPY services/api/package.json services/api/package-lock.json* ./
RUN npm install

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /packages/plan-schema /packages/plan-schema
COPY services/api/ .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /packages/plan-schema /packages/plan-schema
COPY --from=build /app/dist ./dist
COPY services/api/package.json ./
EXPOSE 8080
CMD ["node", "dist/index.js"]

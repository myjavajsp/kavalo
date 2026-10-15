# ---- Build stage: install all deps (incl. dev) and build the standalone server ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime stage: only production deps + built artifacts ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

# The standalone server (dist/server/entry.mjs) listens on this port.
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]

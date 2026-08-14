# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

# Copy just the manifests first so `npm install` is cached across builds
# that only change source, not dependencies.
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install

COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm run build


FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV ROOM_SNAPSHOT_PATH=/data/room.snapshot.json

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/server ./apps/server
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/dist ./apps/web/dist

VOLUME ["/data"]
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget --spider -q http://localhost:${PORT}/health || exit 1

CMD ["npm", "run", "start", "--workspace=apps/server"]

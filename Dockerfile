FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-slim
# ffmpeg makes thumbnails and web-friendly videos from uploads. Static build, same version it was tested with.
COPY --from=mwader/static-ffmpeg:9.0.2 /ffmpeg /ffprobe /usr/local/bin/
WORKDIR /app
# The build is self-contained: no node_modules needed
COPY --from=build /app/build ./build
COPY package.json server.js ./
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]

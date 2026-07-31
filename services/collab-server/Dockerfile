FROM node:22-alpine AS build
WORKDIR /app

# Install deps INSIDE the container so platform-specific native binaries
# (e.g. esbuild's @esbuild/linux-x64-musl) match the Alpine/Linux target,
# instead of copying host node_modules (which may only have e.g. win32-x64).
COPY package.json package-lock.json ./
COPY packages/editor/package.json packages/editor/package.json
COPY services/collab-server/package.json services/collab-server/package.json
RUN npm ci

# The collab-server imports the markdown parser/serializer from the shared
# editor package. node_modules/@type-club/editor is a workspace symlink to
# ../../packages/editor, so the package source must be present at that path.
COPY packages/editor packages/editor
COPY services/collab-server/tsconfig.json services/collab-server/tsconfig.json
COPY services/collab-server/src services/collab-server/src

# Bundle into a single CJS file. This is REQUIRED: running the sources directly
# under tsx loads yjs / prosemirror-model / y-prosemirror as BOTH esm and cjs
# (dual-package hazard) which breaks Yjs constructor checks and Node.fromJSON.
# Bundling collapses every dependency to exactly one instance.
RUN node_modules/.bin/esbuild services/collab-server/src/index.ts \
    --bundle --platform=node --format=cjs --target=node22 \
    --outfile=services/collab-server/dist/index.cjs \
    --external:bufferutil --external:utf-8-validate

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/services/collab-server/dist ./dist

EXPOSE 8001

CMD ["node", "dist/index.cjs"]

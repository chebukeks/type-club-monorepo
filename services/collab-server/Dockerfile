FROM node:22-alpine

WORKDIR /app

COPY node_modules ./node_modules
# The collab-server imports the markdown parser/serializer from the shared
# editor package. node_modules/@type-club/editor is a workspace symlink to
# ../../packages/editor, so the package source must be present at that path.
COPY packages ./packages
COPY services/collab-server/package.json services/collab-server/tsconfig.json ./
COPY services/collab-server/src ./src

# Bundle into a single CJS file. This is REQUIRED: running the sources directly
# under tsx loads yjs / prosemirror-model / y-prosemirror as BOTH esm and cjs
# (dual-package hazard) which breaks Yjs constructor checks and Node.fromJSON.
# Bundling collapses every dependency to exactly one instance.
RUN node_modules/.bin/esbuild src/index.ts \
    --bundle --platform=node --format=cjs --target=node22 \
    --outfile=dist/index.cjs \
    --external:bufferutil --external:utf-8-validate

EXPOSE 8001

CMD ["node", "dist/index.cjs"]

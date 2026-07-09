FROM node:22-alpine

WORKDIR /app

COPY node_modules ./node_modules
# The collab-server imports the markdown parser/serializer from the shared
# editor package. node_modules/@type-club/editor is a workspace symlink to
# ../../packages/editor, so the package source must be present at that path.
COPY packages ./packages
COPY services/collab-server/package.json services/collab-server/tsconfig.json ./
COPY services/collab-server/src ./src

EXPOSE 8001

CMD ["node", "--import", "tsx", "src/index.ts"]

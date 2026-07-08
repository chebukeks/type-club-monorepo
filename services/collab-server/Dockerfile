FROM node:22-alpine

WORKDIR /app

COPY node_modules ./node_modules
COPY services/collab-server/package.json services/collab-server/tsconfig.json ./
COPY services/collab-server/src ./src

EXPOSE 8001

CMD ["node", "--import", "tsx", "src/index.ts"]

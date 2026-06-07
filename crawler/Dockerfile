FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ src/

RUN npm run build

EXPOSE 3001

CMD ["node", "dist/index.js"]

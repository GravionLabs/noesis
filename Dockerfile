FROM node:22-slim AS build
WORKDIR /app
COPY pnpm-lock.yaml package.json ./
RUN npm install -g pnpm && pnpm fetch --prod
COPY . .
RUN pnpm install --offline && pnpm build

FROM node:22-slim
RUN npx playwright install --with-deps chromium 2>/dev/null || true
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/node_modules ./node_modules
EXPOSE 5000
CMD ["node", "dist/index.js"]

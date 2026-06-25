FROM node:22-slim AS deps
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/ui/package.json      ./apps/ui/
RUN npm install -g pnpm@11.8.0 && pnpm install --frozen-lockfile

FROM deps AS ui-build
COPY apps/ui/ ./apps/ui/
RUN pnpm --filter @noesis/ui build

FROM deps AS server-build
COPY apps/server/ ./apps/server/
RUN pnpm --filter @noesis/server build

FROM node:22-slim
RUN npx playwright install --with-deps chromium 2>/dev/null || true
WORKDIR /app
COPY --from=server-build /workspace/apps/server/dist        ./dist
COPY --from=server-build /workspace/apps/server/package.json ./
COPY --from=server-build /workspace/apps/server/node_modules ./node_modules
COPY --from=ui-build     /workspace/apps/ui/dist/ui/browser  ./ui
ENV UI_DIST_PATH=/app/ui
EXPOSE 5000
CMD ["node", "dist/index.js"]

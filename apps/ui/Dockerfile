FROM node:22-slim AS build
WORKDIR /app
COPY pnpm-lock.yaml package.json ./
RUN npm install -g pnpm@11.5.0 && pnpm fetch --prod
COPY . .
RUN pnpm install --offline && pnpm build

FROM nginx:alpine
COPY --from=build /app/dist/ui/browser /usr/share/nginx/html
EXPOSE 80

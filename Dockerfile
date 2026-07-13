FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api-server/package.json apps/api-server/package.json
COPY apps/mcp-server/package.json apps/mcp-server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PROJECT_ROOT=/app
ENV WEB_DIST_DIR=/app/apps/web/dist
ENV MCP_SERVER_ENTRY=apps/mcp-server/dist/apps/mcp-server/src/index.js
ENV ENTERPRISE_AGENT_DB=/app/data/enterprise-agent.db
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/apps ./apps
COPY --from=build /app/packages ./packages
COPY --from=build /app/node_modules ./node_modules
RUN mkdir -p /app/data
EXPOSE 4000
CMD ["sh", "-c", "npm run seed:prod && npm run start"]

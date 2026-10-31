FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm install --workspace=@licitaia/web --workspace=@licitaia/shared --include-workspace-root=false
WORKDIR /app/apps/web
EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0"]

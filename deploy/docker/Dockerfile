# Image de l'application « Planification des IRD » (serveur Node autonome).
# Contexte de build : la racine du projet.
FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g bun
COPY package.json bun.lock* bunfig.toml* ./
RUN bun install
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    NITRO_PRESET=node-server
RUN npx vite build \
 && mkdir -p /out \
 && if [ -f .output/server/index.mjs ]; then cp -r .output/. /out/; else cp -r dist/. /out/; fi \
 && test -f /out/server/index.mjs

FROM node:22-alpine
WORKDIR /app
COPY --from=build /out ./
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
EXPOSE 3000
CMD ["node", "server/index.mjs"]

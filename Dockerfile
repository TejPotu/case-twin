# -------------------------------------------------------
# CaseTwin Frontend — React + Vite → nginx
# Two-stage build. Layer caching: package files copied
# before source so npm ci only re-runs when deps change.
# -------------------------------------------------------

# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy lockfiles first — Docker reuses this layer on rebuilds
# as long as package.json / package-lock.json haven't changed.
COPY package.json package-lock.json ./
RUN npm ci

# Copy source after installing deps so code changes don't bust
# the npm install layer above.
# .env.production is included here (allowed by .dockerignore) and
# Vite automatically reads it during the build to inject VITE_API_URL.
COPY . .

RUN npm run build

# ---- Stage 2: Serve ----
FROM nginx:1.27-alpine AS runtime

# Remove the default server block
RUN rm /etc/nginx/conf.d/default.conf

# Inject our SPA-aware config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

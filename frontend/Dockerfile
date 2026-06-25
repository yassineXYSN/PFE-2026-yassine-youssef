# syntax=docker/dockerfile:1
# check=skip=SecretsUsedInArgOrEnv
# ^ VITE_* values are client-side by design (Vite inlines them into the public
#   JS bundle). TURN credentials are NOT secrets — real secrets live in backend/.env.

############################
# Build the Vite/React app
############################
FROM node:20-alpine AS builder

WORKDIR /app

# Vite inlines VITE_* variables at build time, so they must be present now.
# Override per environment with --build-arg (or the compose `args:` block).
ARG VITE_API_URL=http://localhost:8000
ARG VITE_FRONTEND_URL
ARG VITE_TURN_URL
ARG VITE_TURN_USERNAME
ARG VITE_TURN_CREDENTIAL

ENV VITE_API_URL=$VITE_API_URL \
    VITE_FRONTEND_URL=$VITE_FRONTEND_URL \
    VITE_TURN_URL=$VITE_TURN_URL \
    VITE_TURN_USERNAME=$VITE_TURN_USERNAME \
    VITE_TURN_CREDENTIAL=$VITE_TURN_CREDENTIAL

# Install dependencies against the lockfile first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Build
COPY . .
RUN npm run build

############################
# Serve static build via nginx
############################
FROM nginx:1.27-alpine AS runtime

# SPA-aware nginx config (history fallback + gzip)
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]

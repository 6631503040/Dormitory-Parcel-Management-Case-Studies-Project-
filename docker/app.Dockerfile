# Production image: the React client and the Go API in one container on one origin (Render, or any
# Docker host behind HTTPS). The Go server serves the built client from WEB_DIR, so the session
# cookie and the Resident service worker need no CORS. Build context is the repository root.
#
#   docker build -f docker/app.Dockerfile -t dpms .
#
# docker/backend.Dockerfile (API only) is still what docker-compose uses in development.

FROM node:25-alpine AS web
WORKDIR /web
COPY docs/02-design/prototype/package.json docs/02-design/prototype/package-lock.json ./
RUN npm ci
COPY docs/02-design/prototype/ ./
RUN npm run build

FROM golang:1.26-alpine AS api
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/seed ./cmd/seed \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/vapidkeys ./cmd/vapidkeys

FROM alpine:3.21
RUN adduser -D -u 10001 app
WORKDIR /app
COPY --from=api /out/server /out/seed /out/vapidkeys /app/
COPY db/migrations /app/migrations
COPY --from=web /web/dist /app/web
ENV MIGRATIONS_DIR=/app/migrations \
    WEB_DIR=/app/web \
    APP_ENV=production \
    COOKIE_SECURE=true
USER app
EXPOSE 8080
CMD ["/app/server"]

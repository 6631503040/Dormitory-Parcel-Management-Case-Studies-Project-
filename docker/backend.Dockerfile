# Build context is the repository root (see docker-compose.yml).
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/seed ./cmd/seed \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/createadmin ./cmd/createadmin \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/vapidkeys ./cmd/vapidkeys

FROM alpine:3.24
RUN adduser -D -u 10001 app
WORKDIR /app
COPY --from=build /out/server /out/seed /out/createadmin /out/vapidkeys /app/
COPY db/migrations /app/migrations
USER app
EXPOSE 8080
CMD ["/app/server"]

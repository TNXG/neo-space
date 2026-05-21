# Neo Space Backend (Axum) - 仅复制预构建产物
FROM alpine:3.21

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata wget && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

COPY neo-space-backend-axum /app/neo-space-backend-axum
RUN chmod +x /app/neo-space-backend-axum && \
    mkdir -p /app/cache/artworks && \
    chown -R appuser:appgroup /app/cache

USER appuser

EXPOSE 8000

ENV RUST_LOG=info

CMD ["/app/neo-space-backend-axum"]

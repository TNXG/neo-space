# Neo Space Backend (Axum) - 仅复制预构建产物
FROM alpine:3.23

WORKDIR /app

RUN apk add --no-cache ca-certificates onnxruntime su-exec tzdata && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

COPY neo-space-backend-axum /app/neo-space-backend-axum
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/neo-space-backend-axum /app/docker-entrypoint.sh && \
    mkdir -p /app/.cache/artworks /app/.cache/cargo && \
    chown -R appuser:appgroup /app/.cache

EXPOSE 8000

ENV RUST_LOG=info

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["/app/neo-space-backend-axum"]

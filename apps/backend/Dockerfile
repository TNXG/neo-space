# Neo Space Backend (Axum) - 仅复制预构建产物
FROM alpine:3.23

WORKDIR /app

RUN apk add --no-cache ca-certificates onnxruntime tzdata && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

COPY neo-space-backend-axum /app/neo-space-backend-axum
RUN chmod +x /app/neo-space-backend-axum && \
    mkdir -p /app/.cache/artworks /app/.cache/cargo && \
    chown -R appuser:appgroup /app/.cache

USER appuser

EXPOSE 8000

ENV RUST_LOG=info

CMD ["/app/neo-space-backend-axum"]

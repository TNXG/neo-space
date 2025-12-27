# Neo Space Backend - 仅复制预构建产物
FROM alpine:3.21

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata wget && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

COPY space-api-rs /app/space-api-rs
COPY data/ /app/data/
RUN chmod +x /app/space-api-rs

USER appuser

EXPOSE 8000

ENV ROCKET_ADDRESS=0.0.0.0
ENV ROCKET_PORT=8000

CMD ["/app/space-api-rs"]

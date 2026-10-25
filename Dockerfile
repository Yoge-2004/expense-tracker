ARG UV_VERSION=0.12.15

FROM eclipse-temurin:26-jre

ARG UV_VERSION=0.12.15

ENV DEBIAN_FRONTEND=noninteractive \
    UV_PYTHON_INSTALL_DIR=/opt/uv/python \
    UV_PYTHON_BIN_DIR=/opt/uv/bin \
    PATH=/opt/uv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    MODEL_ID=Yoge-2004/expense-intelligence-model \
    MODEL_REVISION=production \
    MODEL_TYPE=tfidf \
    HF_HOME=/data/cache/huggingface

COPY --from=ghcr.io/astral-sh/uv:0.12.15 /uv /uvx /usr/local/bin/

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx supervisor ca-certificates curl tesseract-ocr tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/* \
    && if id -u 1000 >/dev/null 2>&1; then \
        OLD_USER=$(getent passwd 1000 | cut -d: -f1); \
        OLD_GROUP=$(getent group 1000 | cut -d: -f1); \
        [ "$OLD_USER" != "app" ] && usermod -l app "$OLD_USER"; \
        [ -n "$OLD_GROUP" ] && [ "$OLD_GROUP" != "app" ] && groupmod -n app "$OLD_GROUP"; \
        usermod -d /home/app -m app 2>/dev/null || true; \
    else \
        useradd --create-home --uid 1000 --shell /usr/sbin/nologin app; \
    fi \
    && mkdir -p /data \
    && chown -R app:app /data \
    && uv python install 3.14

WORKDIR /app

# Pre-cache Python ML dependencies before copying full application code
COPY ml/pyproject.toml ml/uv.lock /app/ml/
RUN cd /app/ml && uv sync --frozen --no-dev --no-install-project --extra serve

COPY app.jar /app/app.jar
COPY ml /app/ml
COPY docker/supervisord.conf /etc/supervisor/conf.d/expense-tracker.conf
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh \
    && cd /app/ml \
    && uv sync --frozen --no-dev --extra serve \
    && chown -R app:app /app /opt/uv /data

EXPOSE 7860 8080 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
    CMD curl -fsS http://127.0.0.1:7860/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]

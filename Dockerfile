# ==============================================================================
# Expense Tracker - Combined Hugging Face Space runtime
# ==============================================================================
# One container, three processes:
#   Nginx      :7860  - public Space gateway
#   Spring     :8080  - existing Java backend
#   FastAPI    :8000  - internal Python ML inference
#
# Training is deliberately NOT part of this production image.
# Models are loaded from an explicit Hugging Face Hub revision.
# ==============================================================================

FROM eclipse-temurin:26-jre

ARG UV_VERSION=0.12.15
ENV DEBIAN_FRONTEND=noninteractive \
    UV_PYTHON_INSTALL_DIR=/opt/uv/python \
    UV_PYTHON_BIN_DIR=/opt/uv/bin \
    PATH=/opt/uv/bin:$PATH \
    PYTHONUNBUFFERED=1

COPY --from=ghcr.io/astral-sh/uv:${UV_VERSION} /uv /uvx /usr/local/bin/

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx supervisor ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 --shell /usr/sbin/nologin app \
    && uv python install 3.14

WORKDIR /app

COPY app.jar /app/app.jar
COPY ml /app/ml
COPY docker/supervisord.conf /etc/supervisor/conf.d/expense-tracker.conf
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh \
    && cd /app/ml \
    && if [ -f uv.lock ]; then uv sync --locked --no-dev --extra serve; else uv sync --no-dev --extra serve; fi \
    && chown -R app:app /app /opt/uv

EXPOSE 7860 8080 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
    CMD curl -fsS http://127.0.0.1:7860/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]

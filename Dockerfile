# ==============================================================================
# Expense Tracker Backend - Production Dockerfile for Hugging Face Spaces
# ==============================================================================
# Runtime: Eclipse Temurin OpenJDK 26 JRE
# Platform: Hugging Face Spaces Docker
# Port: 7860
#
# Database policy:
# - Neon PostgreSQL is the authoritative production database.
# - The container image is intentionally stateless and contains NO user data.
# - Optional HF Storage Bucket data is mounted at /data at runtime.
# ==============================================================================

FROM eclipse-temurin:26-jre

WORKDIR /app

COPY app.jar /app/app.jar

RUN chown -R 1000:1000 /app \
    && mkdir -p /data \
    && chown 1000:1000 /data

USER 1000

EXPOSE 7860

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-XX:+ExitOnOutOfMemoryError", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-Dfile.encoding=UTF-8", \
  "-jar", "/app/app.jar", \
  "--server.port=7860"]

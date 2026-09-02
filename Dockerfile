# ==============================================================================
#  Expense Tracker Backend - Production Dockerfile for Hugging Face Spaces
# ==============================================================================
#  Base Runtime: Eclipse Temurin OpenJDK 26 JRE (minimal container runtime)
#  Target Platform: Hugging Face Spaces (CPU-basic / Linux x86_64)
#  Default HF Inbound Port: 7860
# ==============================================================================

FROM eclipse-temurin:26-jre

# ── 1. Working Directory Setup ────────────────────────────────────────────────
# Set the primary application directory where binaries and runtime files reside
WORKDIR /app

# ── 2. Copy Application Artifacts ─────────────────────────────────────────────
# Copy pre-compiled Spring Boot executable fat JAR
COPY app.jar /app/app.jar

# Copy JSON backup sync file for bidirectional DB persistence across restarts
COPY expenses_sync.json /app/expenses_sync.json

# ── 3. Security & Non-Root Execution ──────────────────────────────────────────
# Hugging Face Spaces strictly requires containers to run as a non-root user (UID 1000).
# Ensure read/write ownership over /app so SQLite fallback and sync files can be updated.
RUN chown -R 1000:1000 /app
USER 1000

# ── 4. Networking & Ports ─────────────────────────────────────────────────────
# Hugging Face Spaces reverse proxy routes public HTTP/HTTPS traffic to internal port 7860.
EXPOSE 7860

# ── 5. Optimized JVM Startup Flags & Entrypoint ───────────────────────────────
# JVM Optimization Highlights:
#   -XX:+UseContainerSupport          : Enables dynamic cgroup memory & CPU limit awareness.
#   -XX:MaxRAMPercentage=75.0         : Uses up to 75% of container RAM, avoiding OOM kills.
#   -XX:+ExitOnOutOfMemoryError       : Exits immediately on fatal OOM so HF can auto-restart.
#   -Djava.security.egd=file:/dev/./urandom : Eliminates SecureRandom entropy starvation lag.
#   -Dfile.encoding=UTF-8             : Enforces universal UTF-8 character encoding.
#   --server.port=7860                : Binds Spring Boot embedded server to HF proxy port.
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-XX:+ExitOnOutOfMemoryError", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-Dfile.encoding=UTF-8", \
  "-jar", "/app/app.jar", \
  "--server.port=7860"]

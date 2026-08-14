# Multi-stage Dockerfile: builds latest source from GitHub (eliminates large JAR git LFS limits on HF Spaces)
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /src
RUN git clone --depth 1 https://github.com/Yoge-2004/expense-tracker.git .
RUN ./mvnw clean package -DskipTests -q

# Runtime container
FROM eclipse-temurin:26-jre
WORKDIR /app
COPY --from=builder /src/target/expensetracker-1.0.jar app.jar
COPY --from=builder /src/expenses_sync.json /app/expenses_sync.json

RUN chown -R 1000:1000 /app
USER 1000

EXPOSE 7860
ENTRYPOINT ["java", "-jar", "app.jar", "--server.port=7860"]

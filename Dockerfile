# Multi-stage Dockerfile: builds with Temurin JDK 26 from GitHub main
FROM eclipse-temurin:26-jdk AS builder
WORKDIR /src
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 https://github.com/Yoge-2004/expense-tracker.git .
RUN chmod +x ./mvnw && ./mvnw clean package -DskipTests -q

# Runtime container
FROM eclipse-temurin:26-jre
WORKDIR /app
COPY --from=builder /src/target/expensetracker-1.0.jar app.jar
COPY --from=builder /src/expenses_sync.json /app/expenses_sync.json

RUN chown -R 1000:1000 /app
USER 1000

EXPOSE 7860
ENTRYPOINT ["java", "-jar", "app.jar", "--server.port=7860"]


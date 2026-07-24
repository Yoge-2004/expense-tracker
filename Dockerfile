# Multi-stage Dockerfile for Hugging Face Spaces
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar
COPY expense_tracker.db /app/expense_tracker.db
COPY expenses_sync.json /app/expenses_sync.json

RUN chown -R 1000:1000 /app
USER 1000

EXPOSE 7860
ENTRYPOINT ["java", "-jar", "app.jar", "--server.port=7860"]

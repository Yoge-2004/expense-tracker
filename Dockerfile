# Multi-stage Dockerfile for Hugging Face Spaces (Java 26)
FROM eclipse-temurin:26-jdk AS build
WORKDIR /app

COPY pom.xml .
COPY .mvn .mvn
COPY mvnw .
COPY src ./src
RUN ./mvnw clean package -DskipTests

FROM eclipse-temurin:26-jre
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar
COPY expense_tracker.db /app/expense_tracker.db
COPY expenses_sync.json /app/expenses_sync.json

RUN chown -R 1000:1000 /app
USER 1000

EXPOSE 7860
ENTRYPOINT ["java", "-jar", "app.jar", "--server.port=7860"]

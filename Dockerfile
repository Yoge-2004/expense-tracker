# Single-stage Dockerfile for pre-compiled Spring Boot JAR (Hugging Face Spaces)
FROM eclipse-temurin:26-jre
WORKDIR /app

COPY app.jar app.jar
COPY expenses_sync.json /app/expenses_sync.json

RUN chown -R 1000:1000 /app
USER 1000

EXPOSE 7860
ENTRYPOINT ["java", "-jar", "app.jar", "--server.port=7860"]

# Multi-stage build so the final image ships only the compiled jar and a
# JRE, not the full Maven toolchain or source tree.

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
# Copy the pom first so Docker can cache the dependency download layer --
# it only re-runs `mvn dependency:go-offline` when pom.xml actually changes,
# not on every source edit.
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
# Render (and Railway/Fly) inject PORT at runtime; application.properties
# reads it via server.port=${PORT:8080}.
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

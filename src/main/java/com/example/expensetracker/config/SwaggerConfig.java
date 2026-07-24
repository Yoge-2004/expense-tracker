package com.example.expensetracker.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.ExternalDocumentation;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Swagger / OpenAPI 3.0 configuration for the Expense Tracker System.
 *
 * <p>Registers an {@link OpenAPI} bean that drives the auto-generated
 * Swagger UI available at {@code /swagger-ui/index.html}. The configuration
 * declares a single Bearer-token security scheme so that protected endpoints
 * can be tested directly from the UI after pasting a JWT.</p>
 *
 * <p>Swagger UI URL   : {@code http://localhost:8080/swagger-ui/index.html}</p>
 * <p>OpenAPI JSON URL : {@code http://localhost:8080/v3/api-docs}</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 */
@Configuration
public class SwaggerConfig {

    /** The name used to reference the security scheme throughout the spec. */
    private static final String SECURITY_SCHEME_NAME = "BearerAuth";

    /**
     * Builds and returns the main {@link OpenAPI} specification bean.
     *
     * <p>Includes:</p>
     * <ul>
     *   <li>API metadata (title, description, version, contact, licence).</li>
     *   <li>A {@code BearerAuth} HTTP security scheme for JWT-protected endpoints.</li>
     *   <li>A global security requirement that applies the scheme to all operations
     *       (individual public endpoints override this via {@code @SecurityRequirements({})}).</li>
     *   <li>A default server entry pointing to localhost.</li>
     * </ul>
     *
     * @return the fully configured {@link OpenAPI} instance
     */
    @Bean
    public OpenAPI expenseTrackerOpenAPI() {
        return new OpenAPI()
                .info(apiInfo())
                .externalDocs(new ExternalDocumentation()
                        .description("GitHub Repository")
                        .url("https://github.com/Yoge-2004/expense-tracker"))
                .servers(List.of(
                        new Server()
                                .url("http://localhost:8080")
                                .description("Local Development Server")
                ))
                .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME))
                .components(new Components()
                        .addSecuritySchemes(SECURITY_SCHEME_NAME, bearerSecurityScheme()));
    }

    /**
     * Builds the {@link Info} block containing human-readable API metadata.
     *
     * @return populated {@link Info} object
     */
    private Info apiInfo() {
        return new Info()
                .title("Expense Tracker System API")
                .description("""
                        REST API for the **Expense Tracker System** — a personal finance management \
                        application that lets users track expenses, manage categories, set monthly \
                        budgets, and configure recurring (subscription-style) expenses.

                        ## Authentication
                        All endpoints except `/api/auth/**` require a valid **JWT Bearer token**.
                        1. Call `POST /api/auth/login` with your credentials.
                        2. Copy the `token` from the response.
                        3. Click **Authorize** and paste: `<your-token>` (without `Bearer ` prefix — \
                        the UI adds it automatically).

                        ## Features
                        - **Authentication** — register, login, and reset password.
                        - **Expenses** — full CRUD for expense records.
                        - **Categories** — user-specific and global category management.
                        - **Budgets** — set monthly spending limits and track utilisation.
                        - **Recurring Expenses** — manage auto-renewing monthly subscriptions.
                        """)
                .version("1.0.0")
                .contact(new Contact()
                        .name("Yogeshwaran")
                        .url("https://github.com/Yoge-2004"))
                .license(new License()
                        .name("Apache License 2.0")
                        .url("https://www.apache.org/licenses/LICENSE-2.0"));
    }

    /**
     * Defines the HTTP Bearer security scheme used for JWT authentication.
     *
     * <p>This scheme instructs the Swagger UI to send the token as:
     * {@code Authorization: Bearer <token>}</p>
     *
     * @return configured {@link SecurityScheme} for JWT Bearer tokens
     */
    private SecurityScheme bearerSecurityScheme() {
        return new SecurityScheme()
                .name(SECURITY_SCHEME_NAME)
                .type(SecurityScheme.Type.HTTP)
                .scheme("bearer")
                .bearerFormat("JWT")
                .description("Paste your JWT token here (without the 'Bearer ' prefix). "
                        + "Obtain a token from POST /api/auth/login.");
    }
}

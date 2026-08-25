package com.example.expensetracker.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Redirects requests hitting the bare API root ({@code GET /}) to the
 * Swagger UI, so visitors get a useful landing page instead of a blank
 * response.
 *
 * <p>Originally this also existed to prevent the browser from prompting for
 * HTTP Basic Authentication when visiting the root — Spring Security's
 * {@code httpBasic()} was enabled at the time. That configuration has since
 * been removed (see {@link com.example.expensetracker.config.SecurityConfig}
 * and {@link com.example.expensetracker.security.RestAuthenticationEntryPoint}),
 * since this app only ever authenticates via JWT and {@code httpBasic()}
 * could otherwise trigger a native browser login prompt on a plain
 * navigation. The redirect itself remains useful purely for discoverability.</p>
 */
@Controller
public class HomeController {

    @Operation(
        summary = "Redirect to API documentation",
        description = "Redirects any request to the bare API root to /swagger-ui.html, so visitors land on interactive API documentation instead of an empty response."
    )
    @ApiResponse(responseCode = "302", description = "Redirects to /swagger-ui.html")
    @GetMapping("/")
    public String index() {
        return "redirect:/swagger-ui.html";
    }
}

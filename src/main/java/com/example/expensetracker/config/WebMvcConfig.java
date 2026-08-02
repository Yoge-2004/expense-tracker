package com.example.expensetracker.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.concurrent.TimeUnit;

/**
 * WebMvc configuration that adds cache-control headers for static resources
 * served by Spring Boot, and configures resource handlers for frontend assets.
 *
 * <p>Static assets (CSS, JS, images, fonts) receive public cache headers so
 * browsers and CDNs can serve them from cache, dramatically reducing latency
 * for repeat visitors to the Hugging Face Spaces deployment.</p>
 *
 * <p>The max-age is configurable via the {@code app.cache.static-max-age}
 * property (defaults to 86400 seconds / 1 day).</p>
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${app.cache.static-max-age:86400}")
    private long staticMaxAgeSeconds;

    /**
     * Registers resource handlers for frontend static assets with appropriate
     * Cache-Control headers. These handlers serve:
     * <ul>
     *   <li>{@code /static/**} — JS, CSS, fonts bundled in the jar</li>
     *   <li>{@code /frontend/**} — The vanilla HTML/CSS/JS frontend files</li>
     * </ul>
     *
     * <p>Resources are served with:
     * <ul>
     *   <li>{@code Cache-Control: public, max-age=86400} for immutable-style assets</li>
     *   <li>{@code Vary: Accept-Encoding} is automatically set by Spring</li>
     * </ul>
     * </p>
     *
     * @param registry the resource handler registry
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        CacheControl staticCache = CacheControl
                .maxAge(staticMaxAgeSeconds, TimeUnit.SECONDS)
                .cachePublic()
                .mustRevalidate();

        // Classpath static resources (default Spring Boot location)
        registry.addResourceHandler("/static/**")
                .addResourceLocations("classpath:/static/")
                .setCacheControl(staticCache);

        // Serve frontend HTML/CSS/JS from file system (dev) or classpath
        registry.addResourceHandler("/frontend/**")
                .addResourceLocations(
                        "file:frontend/",
                        "classpath:/frontend/"
                )
                .setCacheControl(staticCache);

        // Shorter cache for HTML pages themselves — allow revalidation
        CacheControl htmlCache = CacheControl
                .maxAge(300, TimeUnit.SECONDS)
                .cachePublic()
                .mustRevalidate();

        registry.addResourceHandler("/*.html")
                .addResourceLocations(
                        "file:frontend/",
                        "classpath:/frontend/"
                )
                .setCacheControl(htmlCache);
    }
}

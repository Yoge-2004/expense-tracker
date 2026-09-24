package com.example.expensetracker.config;

import com.example.expensetracker.security.RateLimitInterceptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.jspecify.annotations.NonNull;
import org.springframework.http.CacheControl;
import org.springframework.web.client.RestClient;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
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
 * <p>Also registers the {@link RateLimitInterceptor} for protecting API routes
 * against brute-force and request flooding attacks.</p>
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final long staticMaxAgeSeconds;
    private final RateLimitInterceptor rateLimitInterceptor;

    public WebMvcConfig(
            @Value("${app.cache.static-max-age:86400}") long staticMaxAgeSeconds,
            @Autowired(required = false) RateLimitInterceptor rateLimitInterceptor) {
        this.staticMaxAgeSeconds = staticMaxAgeSeconds;
        this.rateLimitInterceptor = rateLimitInterceptor;
    }

    @Bean
    @ConditionalOnMissingBean
    public RestClient.Builder restClientBuilder() {
        return RestClient.builder();
    }

    @Override
    public void addInterceptors(@NonNull InterceptorRegistry registry) {
        if (rateLimitInterceptor != null) {
            registry.addInterceptor(rateLimitInterceptor)
                    .addPathPatterns("/api/**");
        }
    }

    /**
     * Registers resource handlers for frontend static assets with appropriate
     * Cache-Control headers.
     *
     * @param registry the resource handler registry
     */
    @Override
    public void addResourceHandlers(@NonNull ResourceHandlerRegistry registry) {
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

        // Direct root-relative assets (/css/**, /js/**, /assets/**, /images/**, /favicon.ico)
        registry.addResourceHandler("/css/**")
                .addResourceLocations("file:frontend/css/", "classpath:/frontend/css/")
                .setCacheControl(staticCache);

        registry.addResourceHandler("/js/**")
                .addResourceLocations("file:frontend/js/", "classpath:/frontend/js/")
                .setCacheControl(staticCache);

        registry.addResourceHandler("/assets/**")
                .addResourceLocations("file:frontend/assets/", "classpath:/frontend/assets/")
                .setCacheControl(staticCache);

        registry.addResourceHandler("/images/**")
                .addResourceLocations("file:frontend/images/", "classpath:/frontend/images/")
                .setCacheControl(staticCache);

        registry.addResourceHandler("/favicon.ico")
                .addResourceLocations("file:frontend/favicon.ico", "classpath:/frontend/favicon.ico")
                .setCacheControl(staticCache);

        // Service Worker script handlers for root and frontend subpaths
        registry.addResourceHandler("/sw.js")
                .addResourceLocations("file:frontend/sw.js", "classpath:/frontend/sw.js")
                .setCacheControl(CacheControl.noCache().mustRevalidate());

        registry.addResourceHandler("/frontend/sw.js")
                .addResourceLocations("file:frontend/sw.js", "classpath:/frontend/sw.js")
                .setCacheControl(CacheControl.noCache().mustRevalidate());

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

package com.example.expensetracker.domain.ai.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.util.UriComponentsBuilder;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import com.example.expensetracker.domain.ai.dto.MlClassificationRequest;
import com.example.expensetracker.domain.ai.dto.MlClassificationResponse;
import com.example.expensetracker.domain.ai.dto.MlLogEntryDto;

/**
 * HTTP client communicating with the Python FastAPI ML inference service.
 */
@Slf4j
@Service
public class MlInferenceClient {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(6);

    private final RestClient client;

    public MlInferenceClient(
            @Autowired(required = false) RestClient.Builder builder,
            @Value("${ml.inference.url:http://127.0.0.1:8000}") String baseUrl) {
        RestClient.Builder effectiveBuilder = builder != null ? builder : RestClient.builder();
        if (builder == null) {
            java.net.http.HttpClient httpClient = java.net.http.HttpClient.newBuilder()
                    .version(java.net.http.HttpClient.Version.HTTP_2)
                    .connectTimeout(CONNECT_TIMEOUT)
                    .build();
            org.springframework.http.client.JdkClientHttpRequestFactory requestFactory =
                    new org.springframework.http.client.JdkClientHttpRequestFactory(httpClient);
            requestFactory.setReadTimeout(READ_TIMEOUT);
            effectiveBuilder.requestFactory(requestFactory);
        }
        this.client = effectiveBuilder
                .baseUrl(baseUrl)
                .build();
    }

    public MlClassificationResponse classify(MlClassificationRequest request) {
        try {
            Map<String, Object> payload = Map.of(
                    "description", request.description().trim(),
                    "top_n", request.effectiveTopN()
            );
            return client.post()
                    .uri("/api/v1/classify")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(MlClassificationResponse.class);
        } catch (RestClientResponseException exception) {
            log.warn("ML classify failed with status={}", exception.getStatusCode().value());
            throw new IllegalStateException(
                    "ML inference service returned HTTP " + exception.getStatusCode().value(), exception);
        } catch (ResourceAccessException exception) {
            log.warn("ML classify unreachable: {}", exception.getMessage());
            throw new IllegalStateException("ML inference service is currently unreachable.", exception);
        }
    }

    public Map<String, Object> matchMerchant(Map<String, Object> payload) {
        return postGeneric("/api/v1/merchants/match", payload);
    }

    public Map<String, Object> checkDuplicates(Map<String, Object> payload) {
        return postGeneric("/api/v1/duplicates/check", payload);
    }

    public Map<String, Object> scoreAnomalies(Map<String, Object> payload) {
        return postGeneric("/api/v1/anomalies/score", payload);
    }

    public Map<String, Object> forecastSpending(Map<String, Object> payload) {
        return postGeneric("/api/v1/forecast/spending", payload);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> health() {
        try {
            Map<String, Object> body = client.get()
                    .uri("/health")
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(Map.class);
            return body != null ? body : Map.of("status", "unavailable");
        } catch (Exception e) {
            log.debug("ML inference health check failed: {}", e.getMessage());
            return Map.of("status", "unavailable");
        }
    }

    public List<MlLogEntryDto> getLogs(int lines, String level, String query) {
        try {
            UriComponentsBuilder uriBuilder = UriComponentsBuilder.fromPath("/api/v1/logs")
                    .queryParam("lines", lines)
                    .queryParam("level", level != null ? level : "ALL");
            if (query != null && !query.isBlank()) {
                uriBuilder.queryParam("query", query);
            }
            List<MlLogEntryDto> logs = client.get()
                    .uri(uriBuilder.build().toUriString())
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(new ParameterizedTypeReference<List<MlLogEntryDto>>() {});
            return logs != null ? logs : List.of();
        } catch (Exception _) {
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> postGeneric(String uri, Map<String, Object> payload) {
        try {
            Map<String, Object> body = client.post()
                    .uri(uri)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(Map.class);
            return body != null ? body : Map.of();
        } catch (RestClientResponseException exception) {
            log.warn("ML POST {} failed with status={}", uri, exception.getStatusCode().value());
            throw new IllegalStateException(
                    "ML inference service returned HTTP " + exception.getStatusCode().value(), exception);
        } catch (ResourceAccessException exception) {
            log.warn("ML POST {} unreachable: {}", uri, exception.getMessage());
            throw new IllegalStateException("ML inference service is currently unreachable.", exception);
        }
    }
}

package com.example.expensetracker.service;

import com.example.expensetracker.dto.MlClassificationRequest;
import com.example.expensetracker.dto.MlClassificationResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.ResourceAccessException;

import java.time.Duration;
import java.util.Map;

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
            SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
            requestFactory.setConnectTimeout(CONNECT_TIMEOUT);
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
            throw new IllegalStateException(
                    "ML inference service returned HTTP " + exception.getStatusCode().value(), exception);
        } catch (ResourceAccessException exception) {
            throw new IllegalStateException(
                    "ML inference service is unreachable at " + exception.getMessage(), exception);
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
            return client.get()
                    .uri("/health")
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(Map.class);
        } catch (Exception e) {
            return Map.of("status", "unavailable", "error", e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> postGeneric(String uri, Map<String, Object> payload) {
        try {
            return client.post()
                    .uri(uri)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(Map.class);
        } catch (RestClientResponseException exception) {
            throw new IllegalStateException(
                    "ML inference service returned HTTP " + exception.getStatusCode().value(), exception);
        } catch (ResourceAccessException exception) {
            throw new IllegalStateException(
                    "ML inference service is unreachable at " + exception.getMessage(), exception);
        }
    }
}

package com.example.expensetracker.service;

import com.example.expensetracker.dto.MlClassificationRequest;
import com.example.expensetracker.dto.MlClassificationResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.ResourceAccessException;

import java.util.Map;

@Service
public class MlInferenceClient {

    private final RestClient client;

    public MlInferenceClient(
            RestClient.Builder builder,
            @Value("${ml.inference.url:http://127.0.0.1:8000}") String baseUrl) {
        this.client = builder.baseUrl(baseUrl).build();
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
            throw new IllegalStateException("ML inference service is unavailable", exception);
        }
    }
}

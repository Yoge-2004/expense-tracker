package com.example.expensetracker.service;

import com.example.expensetracker.dto.MlClassificationRequest;
import com.example.expensetracker.dto.MlClassificationResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class MlInferenceClientTest {

    private MockRestServiceServer mockServer;
    private MlInferenceClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        mockServer = MockRestServiceServer.bindTo(builder).build();
        client = new MlInferenceClient(builder, "http://127.0.0.1:8000");
    }

    @Test
    @DisplayName("classify: parses response when FastAPI returns 200 OK")
    void classify_success_returnsResponse() {
        String responseJson = """
                {
                    "category": "food_dining",
                    "confidence": 0.985,
                    "topK": [{"category": "food_dining", "confidence": 0.985}],
                    "modelRevision": "category-tfidf@2.0.0",
                    "modelType": "tfidf"
                }
                """;

        mockServer.expect(requestTo("http://127.0.0.1:8000/api/v1/classify"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Content-Type", MediaType.APPLICATION_JSON_VALUE))
                .andExpect(jsonPath("$.description").value("Uber Eats food delivery"))
                .andExpect(jsonPath("$.top_n").value(3))
                .andRespond(withSuccess(responseJson, MediaType.APPLICATION_JSON));

        MlClassificationResponse response = client.classify(
                new MlClassificationRequest("Uber Eats food delivery", 3));

        assertNotNull(response);
        assertEquals("food_dining", response.category());
        assertEquals(0.985, response.confidence(), 0.001);
        assertEquals("category-tfidf@2.0.0", response.modelRevision());
        assertEquals("tfidf", response.modelType());
        mockServer.verify();
    }

    @Test
    @DisplayName("classify: downstream HTTP error throws IllegalStateException")
    void classify_downstreamHttpError_throwsIllegalStateException() {
        mockServer.expect(requestTo("http://127.0.0.1:8000/api/v1/classify"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                client.classify(new MlClassificationRequest("Uber Eats", 3)));

        assertTrue(ex.getMessage().contains("ML inference service returned HTTP 500"));
        mockServer.verify();
    }

    @Test
    @DisplayName("classify: uses effectiveTopN default 3 when topN is null")
    void classify_nullTopN_usesEffectiveTopN() {
        String responseJson = """
                {
                    "category": "transportation",
                    "confidence": 0.92,
                    "topK": [],
                    "modelRevision": "category-tfidf@2.0.0",
                    "modelType": "tfidf"
                }
                """;

        mockServer.expect(requestTo("http://127.0.0.1:8000/api/v1/classify"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.top_n").value(3))
                .andRespond(withSuccess(responseJson, MediaType.APPLICATION_JSON));

        MlClassificationResponse response = client.classify(
                new MlClassificationRequest("Metro ticket", null));

        assertEquals("transportation", response.category());
        mockServer.verify();
    }
}

package com.example.expensetracker.dto;

import com.example.expensetracker.controller.WebAuthnController.WebAuthnFinishRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/** Bean Validation rules on request bodies that previously accepted anything. */
class RequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void start() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void stop() {
        factory.close();
    }

    private static <T> Set<String> fieldsWithViolations(T bean) {
        return validator.validate(bean).stream()
                .map(ConstraintViolation::getPropertyPath)
                .map(Object::toString)
                .collect(Collectors.toSet());
    }

    private static UserAppearanceDto appearance(String wallpaperType, Double opacity, Integer blur, String primary) {
        return new UserAppearanceDto("grotesk", null, null, "default", primary, "#A97F2E", "#A23E32", "#4C7A78",
                "rgba(23, 26, 20, 0.88)", "#171A14", "rgba(199, 154, 62, 0.35)", wallpaperType, null, opacity, blur);
    }

    // ----- appearance -----

    @Test
    void theDefaultAppearanceTheAppShipsWithIsValid() {
        assertTrue(validator.validate(appearance("preset", 0.35, 0, "#C79A3E")).isEmpty());
    }

    @Test
    void partialUpdatesWithNullsAreValid() {
        UserAppearanceDto onlyFont = new UserAppearanceDto("mono", null, null, null, null, null, null, null,
                null, null, null, null, null, null, null);
        assertTrue(validator.validate(onlyFont).isEmpty());
    }

    @Test
    void everyWallpaperTypeTheClientsSendIsAccepted() {
        for (String type : List.of("preset", "custom", "none")) {
            assertTrue(validator.validate(appearance(type, 0.5, 5, "#C79A3E")).isEmpty(), type);
        }
    }

    @Test
    void unknownWallpaperTypeIsRejected() {
        assertEquals(Set.of("wallpaperType"), fieldsWithViolations(appearance("gallery", 0.5, 5, "#C79A3E")));
    }

    @Test
    void opacityAndBlurOutsideAnyRealRangeAreRejected() {
        assertEquals(Set.of("overlayOpacity"), fieldsWithViolations(appearance("preset", 7.5, 0, "#C79A3E")));
        assertEquals(Set.of("overlayOpacity"), fieldsWithViolations(appearance("preset", -0.1, 0, "#C79A3E")));
        assertEquals(Set.of("blurIntensity"), fieldsWithViolations(appearance("preset", 0.3, 999, "#C79A3E")));
        assertEquals(Set.of("blurIntensity"), fieldsWithViolations(appearance("preset", 0.3, -1, "#C79A3E")));
    }

    @Test
    void valuesLongerThanTheirDatabaseColumnAreRejectedInsteadOfFailingInTheDatabase() {
        assertEquals(Set.of("primaryColor"), fieldsWithViolations(appearance("preset", 0.3, 0, "#".repeat(31))));
    }

    @Test
    void theSliderEndpointsOfTheWebStudioAreAccepted() {
        assertTrue(validator.validate(appearance("custom", 0.9, 20, "#C79A3E")).isEmpty());
        assertTrue(validator.validate(appearance("custom", 0.0, 0, "#C79A3E")).isEmpty());
    }

    // ----- account deletion -----

    @Test
    void deleteAccountAcceptsNoPinAnEmptyPinOrSixDigits() {
        assertTrue(validator.validate(new DeleteAccountRequest("secret123", null, null)).isEmpty());
        assertTrue(validator.validate(new DeleteAccountRequest("secret123", "", null)).isEmpty());
        assertTrue(validator.validate(new DeleteAccountRequest(null, "123456", null)).isEmpty());
    }

    @Test
    void deleteAccountRejectsMalformedPinAndOversizedFields() {
        assertEquals(Set.of("securityPin"), fieldsWithViolations(new DeleteAccountRequest("x", "12ab56", null)));
        assertEquals(Set.of("securityPin"), fieldsWithViolations(new DeleteAccountRequest("x", "1234567", null)));
        assertEquals(Set.of("password"), fieldsWithViolations(new DeleteAccountRequest("p".repeat(256), null, null)));
        assertEquals(Set.of("googleIdToken"), fieldsWithViolations(new DeleteAccountRequest(null, null, "t".repeat(4097))));
    }

    // ----- notifications -----

    @Test
    void notificationListsAreBounded() {
        assertTrue(validator.validate(new NotificationRequests.MarkRead(null)).isEmpty());
        assertTrue(validator.validate(new NotificationRequests.MarkRead(List.of(1L, 2L))).isEmpty());
        List<Long> tooMany = java.util.stream.LongStream.rangeClosed(1, 1001).boxed().toList();
        assertFalse(validator.validate(new NotificationRequests.MarkRead(tooMany)).isEmpty());

        assertTrue(validator.validate(new NotificationRequests.Preferences(List.of("BUDGET_ALERT"))).isEmpty());
        assertFalse(validator.validate(new NotificationRequests.Preferences(List.of("X".repeat(41)))).isEmpty());
    }

    // ----- OCR text and WebAuthn -----

    @Test
    void receiptTextIsCapped() {
        assertTrue(validator.validate(new ReceiptTextRequest(null)).isEmpty());
        assertTrue(validator.validate(new ReceiptTextRequest("Total 540.00")).isEmpty());
        assertTrue(validator.validate(new ReceiptTextRequest("a".repeat(20_000))).isEmpty());
        assertFalse(validator.validate(new ReceiptTextRequest("a".repeat(20_001))).isEmpty());
    }

    @Test
    void webAuthnPayloadsAreBounded() {
        assertTrue(validator.validate(new WebAuthnFinishRequest("tx-1", "{\"id\":\"abc\"}")).isEmpty());
        assertTrue(validator.validate(new WebAuthnFinishRequest(null, null)).isEmpty());
        assertEquals(Set.of("transactionId"), fieldsWithViolations(new WebAuthnFinishRequest("t".repeat(101), "{}")));
        assertEquals(Set.of("credential"), fieldsWithViolations(new WebAuthnFinishRequest("tx", "c".repeat(65_537))));
    }
}

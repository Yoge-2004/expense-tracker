package com.example.expensetracker.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Thrown when outbound email delivery fails (e.g. SMTP connection timeout, invalid recipient).
 */
@ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
public class EmailDeliveryException extends RuntimeException {
    public EmailDeliveryException(String message) {
        super(message);
    }

    public EmailDeliveryException(String message, Throwable cause) {
        super(message, cause);
    }
}

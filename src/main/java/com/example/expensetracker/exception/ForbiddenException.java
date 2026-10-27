package com.example.expensetracker.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * The caller is signed in and the request is well formed, but their role does not allow the action
 * (for example an Administrator trying to change a role, which only a Super Administrator may do).
 * Mapped to HTTP 403, unlike {@link BadRequestException} which means the request itself was wrong.
 */
@ResponseStatus(HttpStatus.FORBIDDEN)
public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}

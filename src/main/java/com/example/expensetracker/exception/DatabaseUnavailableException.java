package com.example.expensetracker.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Signals that the application's database is unreachable — mapped to HTTP
 * {@code 503 Service Unavailable} via {@code @ResponseStatus} and handled
 * identically to genuine framework-level connectivity failures (see {@link
 * com.example.expensetracker.exception.GlobalExceptionHandler#handleDatabaseUnavailable},
 * which registers this alongside {@code DataAccessException}, {@code
 * CannotCreateTransactionException}, {@code JDBCConnectionException}, and
 * {@code SQLException} in the same handler).
 *
 * <p>Exists so application code can explicitly signal "the database is down"
 * with the same 503 treatment a real JDBC failure would get, without needing
 * to trigger an actual connectivity exception to do so — useful for
 * defensive checks (e.g. a health probe) that want to fail the same way a
 * real outage would.</p>
 */
@ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
public class DatabaseUnavailableException extends RuntimeException {
    public DatabaseUnavailableException(String message) {
        super(message);
    }

    public DatabaseUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}

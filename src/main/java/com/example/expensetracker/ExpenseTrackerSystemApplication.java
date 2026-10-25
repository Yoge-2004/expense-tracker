package com.example.expensetracker;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

/**
 * Entry point for the Expense Tracker System application.
 *
 * <p>This Spring Boot application provides a RESTful API for managing personal
 * finances, including expenses, categories, budgets, and recurring expenses.
 * It uses JWT-based authentication and a stateless session management strategy.</p>
 *
 * <p>Scheduling is enabled to support automatic processing of recurring expenses
 * on a daily cron basis via {@link com.example.expensetracker.service.RecurringExpenseScheduler}.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see org.springframework.boot.autoconfigure.SpringBootApplication
 * @see org.springframework.scheduling.annotation.EnableScheduling
 */
@Slf4j
@EnableScheduling
@SpringBootApplication
public class ExpenseTrackerSystemApplication {

    /**
     * Anchors the entire JVM runtime timezone to UTC so all database timestamps,
     * serialization, and scheduling base calculations remain consistent across
     * all environments (local, Docker, and cloud).
     */
    @PostConstruct
    void initTimeZone() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        log.info("JVM default timezone initialized to UTC.");
    }

    /**
     * Main method that bootstraps and launches the Spring Boot application.
     *
     * @param args command-line arguments passed at startup (not used directly)
     */
    static void main(String[] args) {
        log.info("Starting Expense Tracker Application...");
        SpringApplication.run(ExpenseTrackerSystemApplication.class, args);
        log.info("Expense Tracker Application started successfully.");
    }

}

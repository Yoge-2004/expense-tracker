package com.example.expensetracker;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

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
@EnableScheduling
@SpringBootApplication
public class ExpenseTrackerSystemApplication {

    /**
     * Main method that bootstraps and launches the Spring Boot application.
     *
     * @param args command-line arguments passed at startup (not used directly)
     */
    public static void main(String[] args) {
        SpringApplication.run(ExpenseTrackerSystemApplication.class, args);
    }

}

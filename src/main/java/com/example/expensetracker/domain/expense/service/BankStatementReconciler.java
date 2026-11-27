package com.example.expensetracker.domain.expense.service;

import java.util.Map;
import org.springframework.web.multipart.MultipartFile;

import com.example.expensetracker.domain.user.model.User;

/**
 * Port for reconciling uploaded bank statements against user transactions.
 */
public interface BankStatementReconciler {

    /**
     * Reconciles an uploaded bank statement file against recorded user transactions.
     *
     * @param file uploaded bank statement file (.csv, .xlsx, .xls)
     * @param user target authenticated user
     * @return structured reconciliation summary
     */
    Map<String, Object> reconcileBankStatement(MultipartFile file, User user);
}

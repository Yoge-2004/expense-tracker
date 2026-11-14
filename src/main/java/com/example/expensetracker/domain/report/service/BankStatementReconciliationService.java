package com.example.expensetracker.domain.report.service;

import org.springframework.web.multipart.MultipartFile;
import java.util.Map;

import com.example.expensetracker.domain.user.model.User;



/**
 * Segregated service contract dedicated exclusively to automated bank statement reconciliation.
 *
 * <p>Enforces the Interface Segregation Principle (ISP) by separating ledger reconciliation
 * from standard single-domain CSV/JSON/Excel transaction imports.</p>
 *
 * @author Yogeshwaran
 */
public interface BankStatementReconciliationService {

    /**
     * Reconciles an uploaded bank statement (.csv, .xlsx, or .xls) against existing user records.
     *
     * @param file the uploaded bank statement file
     * @param user the target authenticated user
     * @return a structured map containing reconciliation results
     */
    Map<String, Object> reconcileBankStatement(MultipartFile file, User user);
}

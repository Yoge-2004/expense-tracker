package com.example.expensetracker.controller;

import com.example.expensetracker.dto.MonthlyReportDto;
import com.example.expensetracker.service.MonthlyReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Collections;

@Tag(name = "Reports", description = "Monthly financial summary reports and automated email dispatches.")
@SecurityRequirement(name = "BearerAuth")
@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final MonthlyReportService monthlyReportService;

    public ReportController(MonthlyReportService monthlyReportService) {
        this.monthlyReportService = monthlyReportService;
    }

    @Operation(summary = "Get monthly financial report JSON")
    @GetMapping("/monthly/user/{userId}")
    public ResponseEntity<MonthlyReportDto> getMonthlyReport(
            @PathVariable Long userId,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month) {

        LocalDate now = LocalDate.now();
        int y = year != null ? year : now.getYear();
        int m = month != null ? month : now.getMonthValue();

        MonthlyReportDto report = monthlyReportService.generateMonthlyReport(userId, y, m);
        return ResponseEntity.ok(report);
    }

    @Operation(summary = "Trigger sending monthly financial report to user's email")
    @PostMapping("/monthly/user/{userId}/send-email")
    public ResponseEntity<?> sendMonthlyReportEmail(
            @PathVariable Long userId,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month) {

        LocalDate now = LocalDate.now();
        int y = year != null ? year : now.getYear();
        int m = month != null ? month : now.getMonthValue();

        monthlyReportService.sendMonthlyReportEmail(userId, y, m);
        return ResponseEntity.ok(Collections.singletonMap("message", "Monthly report email successfully sent."));
    }
}

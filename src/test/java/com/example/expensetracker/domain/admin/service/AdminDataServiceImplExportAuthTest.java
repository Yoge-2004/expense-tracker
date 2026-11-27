package com.example.expensetracker.domain.admin.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.example.expensetracker.domain.expense.repository.CategoryRepository;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.user.model.Role;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;
import com.example.expensetracker.infrastructure.exception.BadRequestException;
import com.example.expensetracker.infrastructure.exception.ForbiddenException;
import com.example.expensetracker.infrastructure.resilience.DatabaseSnapshotService;
import com.example.expensetracker.domain.user.security.StepUpPinVerifier;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;

@DisplayName("AdminDataServiceImpl bulk-export authorisation")
class AdminDataServiceImplExportAuthTest {

    private AdminAuditService auditService;
    private StepUpPinVerifier pinVerifier;
    private AdminDataServiceImpl service;

    @BeforeEach
    void setUp() {
        auditService = mock(AdminAuditService.class);
        pinVerifier = mock(StepUpPinVerifier.class);
        service = new AdminDataServiceImpl(
                mock(ExpenseRepository.class),
                mock(IncomeRepository.class),
                mock(UserRepository.class),
                mock(CategoryRepository.class),
                mock(DatabaseSnapshotService.class),
                auditService,
                pinVerifier,
                new ObjectMapper());
    }

    private static User userWithRole(Role role) {
        return User.builder().id(7L).username("op").email("op@example.com").role(role).build();
    }

    @Test
    @DisplayName("a plain admin is refused before the PIN is even checked")
    void plainAdminIsForbidden() {
        assertThrows(ForbiddenException.class, () ->
                service.authorizeBulkExport(userWithRole(Role.ROLE_ADMIN), "123456", "EXPORT_PLATFORM_LEDGER", "1.2.3.4", "ua"));

        verify(pinVerifier, never()).verify(any(), any());
        verify(auditService, never()).recordAction(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("a missing or blank PIN is rejected and nothing is audited as authorised")
    void missingPinIsRejected() {
        User superAdmin = userWithRole(Role.ROLE_SUPER_ADMIN);

        assertThrows(BadRequestException.class, () ->
                service.authorizeBulkExport(superAdmin, null, "EXPORT_PLATFORM_LEDGER", "1.2.3.4", "ua"));
        assertThrows(BadRequestException.class, () ->
                service.authorizeBulkExport(superAdmin, "   ", "EXPORT_PLATFORM_LEDGER", "1.2.3.4", "ua"));

        verify(pinVerifier, never()).verify(any(), any());
        verify(auditService, never()).recordAction(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("a wrong PIN propagates the verifier's failure and writes no audit entry")
    void wrongPinIsNotAudited() {
        User superAdmin = userWithRole(Role.ROLE_SUPER_ADMIN);
        org.mockito.Mockito.doThrow(new BadRequestException("Invalid security PIN"))
                .when(pinVerifier).verify(superAdmin, "000000");

        assertThrows(BadRequestException.class, () ->
                service.authorizeBulkExport(superAdmin, "000000", "EXPORT_DATABASE_SNAPSHOT", "1.2.3.4", "ua"));

        verify(auditService, never()).recordAction(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("a Super Admin with the right PIN is audited with the action name and client details")
    void authorisedExportIsAudited() {
        User superAdmin = userWithRole(Role.ROLE_SUPER_ADMIN);

        service.authorizeBulkExport(superAdmin, "123456", "EXPORT_DATABASE_SNAPSHOT", "1.2.3.4", "Mozilla");

        verify(pinVerifier).verify(superAdmin, "123456");
        verify(auditService).recordAction(
                ArgumentMatchers.eq(7L),
                ArgumentMatchers.eq("op"),
                ArgumentMatchers.eq("EXPORT_DATABASE_SNAPSHOT"),
                ArgumentMatchers.eq("PLATFORM_DATA"),
                ArgumentMatchers.eq("EXPORT_DATABASE_SNAPSHOT"),
                any(),
                ArgumentMatchers.eq("1.2.3.4"),
                ArgumentMatchers.eq("Mozilla"));
    }
}

package com.example.expensetracker.service;

import com.example.expensetracker.dto.ExpenseDto;
import com.example.expensetracker.model.*;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import com.example.expensetracker.security.UserSecurity;
import com.example.expensetracker.service.impl.RecurringExpenseServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecurringExpenseServiceTest {

    @Mock private RecurringExpenseRepository recurringRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private ExpenseService expenseService;
    @Mock private UserService userService;
    @Mock private UserSecurity userSecurity;

    @InjectMocks
    private RecurringExpenseServiceImpl recurringExpenseService;

    private User user;
    private Category category;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(7L);
        user.setName("John Doe");

        category = new Category();
        category.setId(2L);
        category.setName("Streaming");
        category.setUser(user);
    }

    @Test
    void createRecurringExpenseRejectsInvalidCustomInterval() {
        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(categoryRepository.findById(2L)).thenReturn(Optional.of(category));

        ExpenseDto dto = new ExpenseDto(null, new BigDecimal("100"), "Sub", LocalDate.now(),
                2L, "Streaming", "CUSTOM", 0, null, true);

        assertThatThrownBy(() -> recurringExpenseService.createRecurringExpense(7L, dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Custom frequency requires a positive interval in days");

        verify(recurringRepository, never()).save(any());
        verify(expenseService, never()).createExpense(any(), any());
    }

    @Test
    void createRecurringExpenseSavesScheduleAndFirstOccurrence() {
        LocalDate startDate = LocalDate.of(2026, 3, 15);
        ExpenseDto dto = new ExpenseDto(null, new BigDecimal("649"), "Netflix", startDate,
                2L, "Streaming", "MONTHLY", null, null, true);

        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(categoryRepository.findById(2L)).thenReturn(Optional.of(category));

        recurringExpenseService.createRecurringExpense(7L, dto);

        verify(recurringRepository).save(argThat(rec ->
                new BigDecimal("649").compareTo(rec.getAmount()) == 0
                        && "Netflix".equals(rec.getDescription())
                        && "MONTHLY".equals(rec.getFrequency())
                        && LocalDate.of(2026, 4, 15).equals(rec.getNextDueDate())
                        && rec.getUser().equals(user)
                        && rec.getCategory().equals(category)));

        verify(expenseService).createExpense(argThat(firstExp ->
                new BigDecimal("649").compareTo(firstExp.getAmount()) == 0
                        && "Netflix".equals(firstExp.getDescription())
                        && startDate.equals(firstExp.getExpenseDate())
                        && firstExp.isRecurring()), eq(user));
    }

    @Test
    void getUserSubscriptionsReturnsSerializedList() {
        RecurringExpense rec = new RecurringExpense();
        rec.setId(10L);
        rec.setDescription("Spotify");
        rec.setAmount(new BigDecimal("119"));
        rec.setFrequency("MONTHLY");
        rec.setNextDueDate(LocalDate.of(2026, 4, 1));
        rec.setCategory(category);
        rec.setUser(user);

        when(userService.findById(7L)).thenReturn(Optional.of(user));
        when(recurringRepository.findByUser(user)).thenReturn(List.of(rec));

        List<Map<String, Object>> subs = recurringExpenseService.getUserSubscriptions(7L);

        assertThat(subs).hasSize(1);
        assertThat(subs.get(0).get("id")).isEqualTo(10L);
        assertThat(subs.get(0).get("description")).isEqualTo("Spotify");
        assertThat(subs.get(0).get("categoryName")).isEqualTo("Streaming");
    }

    @Test
    void updateSubscriptionAppliesUpdatedFields() {
        RecurringExpense rec = new RecurringExpense();
        rec.setId(10L);
        rec.setDescription("Netflix");
        rec.setAmount(new BigDecimal("649"));
        rec.setFrequency("MONTHLY");
        rec.setNextDueDate(LocalDate.of(2026, 4, 1));
        rec.setUser(user);

        when(recurringRepository.findById(10L)).thenReturn(Optional.of(rec));

        Map<String, Object> updates = Map.of(
                "amount", "799",
                "description", "Netflix 4K",
                "nextDueDate", "2026-05-01"
        );

        recurringExpenseService.updateSubscription(10L, updates);

        verify(recurringRepository).save(argThat(saved ->
                new BigDecimal("799").compareTo(saved.getAmount()) == 0
                        && "Netflix 4K".equals(saved.getDescription())
                        && LocalDate.of(2026, 5, 1).equals(saved.getNextDueDate())));
    }

    @Test
    void deleteSubscriptionValidatesAndDeletesEntity() {
        RecurringExpense rec = new RecurringExpense();
        rec.setId(10L);
        rec.setUser(user);

        when(recurringRepository.findById(10L)).thenReturn(Optional.of(rec));

        recurringExpenseService.deleteSubscription(10L);

        verify(userSecurity).validateUserAccess(7L);
        verify(recurringRepository).delete(rec);
    }
}

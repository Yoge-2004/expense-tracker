package com.example.expensetracker.domain.admin.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.expensetracker.domain.expense.repository.CategoryRepository;
import com.example.expensetracker.domain.expense.repository.ExpenseRepository;
import com.example.expensetracker.domain.income.repository.IncomeRepository;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;
import com.example.expensetracker.infrastructure.resilience.DatabaseSnapshotService;
import com.example.expensetracker.infrastructure.resilience.HuggingFaceDatabaseFailoverService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.io.ByteArrayOutputStream;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

@DisplayName("AdminDataServiceImpl.writePlatformLedger")
class AdminDataServiceImplLedgerTest {

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private ExpenseRepository expenseRepository;
    private IncomeRepository incomeRepository;
    private UserRepository userRepository;
    private CategoryRepository categoryRepository;
    private AdminDataServiceImpl service;

    @BeforeEach
    void setUp() {
        expenseRepository = mock(ExpenseRepository.class);
        incomeRepository = mock(IncomeRepository.class);
        userRepository = mock(UserRepository.class);
        categoryRepository = mock(CategoryRepository.class);
        service = new AdminDataServiceImpl(
                expenseRepository,
                incomeRepository,
                userRepository,
                categoryRepository,
                mock(DatabaseSnapshotService.class),
                mock(HuggingFaceDatabaseFailoverService.class),
                objectMapper);

        when(expenseRepository.findAllWithCategory(any(Pageable.class))).thenReturn(Page.empty());
        when(incomeRepository.findAllIncomes(any(Pageable.class))).thenReturn(Page.empty());
        when(categoryRepository.findAll(any(Pageable.class))).thenReturn(Page.empty());
    }

    private static User user(long id, String email) {
        User user = new User();
        user.setId(id);
        user.setName("User " + id);
        user.setEmail(email);
        user.setEnabled(true);
        return user;
    }

    @Test
    @DisplayName("reads every page and reports totals")
    void readsEveryPage() throws Exception {
        // 501 users at 500 per page means two pages.
        when(userRepository.findAll(any(Pageable.class))).thenReturn(
                new PageImpl<>(List.of(user(1, "a@b.com")), PageRequest.of(0, 500), 501),
                new PageImpl<>(List.of(user(2, "c@d.com")), PageRequest.of(1, 500), 501));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        service.writePlatformLedger(out);

        JsonNode json = objectMapper.readTree(out.toByteArray());
        assertTrue(json.hasNonNull("timestamp"));
        assertEquals(2, json.get("totalUsers").asInt());
        assertEquals(2, json.get("users").size());
        assertEquals("a@b.com", json.get("users").get(0).get("email").asText());
        assertEquals("ROLE_USER", json.get("users").get(0).get("role").asText());
        assertEquals("c@d.com", json.get("users").get(1).get("email").asText());
        assertEquals(0, json.get("totalExpensesCount").asInt());
        assertTrue(json.get("expenses").isArray());
        assertEquals(0, json.get("totalIncomesCount").asInt());
        assertEquals(0, json.get("totalCategoriesCount").asInt());
        verify(userRepository, times(2)).findAll(any(Pageable.class));
    }

    @Test
    @DisplayName("produces valid JSON with empty arrays for an empty database")
    void emptyDatabase() throws Exception {
        when(userRepository.findAll(any(Pageable.class))).thenReturn(Page.empty());

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        service.writePlatformLedger(out);

        JsonNode json = objectMapper.readTree(out.toByteArray());
        assertEquals(0, json.get("totalUsers").asInt());
        assertTrue(json.get("users").isArray());
        assertEquals(0, json.get("users").size());
    }
}

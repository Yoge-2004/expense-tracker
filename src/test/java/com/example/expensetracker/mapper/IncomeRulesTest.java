package com.example.expensetracker.mapper;

import com.example.expensetracker.dto.IncomeDto;
import com.example.expensetracker.dto.IncomeRequest;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.IncomeKind;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("IncomeRules — kind and counts-toward-month classification")
class IncomeRulesTest {

    private static Income income(String source, LocalDate date) {
        Income income = new Income();
        income.setSource(source);
        income.setIncomeDate(date);
        income.setIsRecurring(false);
        return income;
    }

    private static IncomeRequest request(String kind, String month, Long categoryId) {
        return new IncomeRequest(new BigDecimal("100.00"), "Salary", null, LocalDate.of(2026, 10, 30),
                false, null, null, kind, month, categoryId);
    }

    @Nested
    @DisplayName("kind")
    class Kind {

        @Test
        @DisplayName("parses names case-insensitively; null and blank mean not specified")
        void parseKind() {
            assertEquals(IncomeKind.SALARY, IncomeRules.parseKind(" salary "));
            assertEquals(IncomeKind.REIMBURSEMENT, IncomeRules.parseKind("Reimbursement"));
            assertNull(IncomeRules.parseKind(null));
            assertNull(IncomeRules.parseKind("  "));
        }

        @Test
        @DisplayName("an unknown kind is rejected with a message listing the valid ones")
        void unknownKindRejected() {
            IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () -> IncomeRules.parseKind("bonus"));
            assertTrue(e.getMessage().contains("SALARY"));
        }

        @Test
        @DisplayName("older rows without a kind are inferred from the source")
        void inferredFromSource() {
            assertEquals(IncomeKind.SALARY, IncomeRules.effectiveKind(income("Tech Corp Salary", LocalDate.of(2026, 10, 1))));
            assertEquals(IncomeKind.OTHER, IncomeRules.effectiveKind(income("Freelance", LocalDate.of(2026, 10, 1))));
        }

        @Test
        @DisplayName("a stored kind wins over the source, and an unreadable stored value falls back to inference")
        void storedKindWins() {
            Income refund = income("Salary advance", LocalDate.of(2026, 10, 1));
            refund.setKind("REIMBURSEMENT");
            assertEquals(IncomeKind.REIMBURSEMENT, IncomeRules.effectiveKind(refund));

            refund.setKind("garbage");
            assertEquals(IncomeKind.SALARY, IncomeRules.effectiveKind(refund));
        }
    }

    @Nested
    @DisplayName("counts-toward month")
    class Month {

        @Test
        @DisplayName("defaults to the month of the credit date")
        void defaultsToCreditMonth() {
            assertEquals(YearMonth.of(2026, 10), IncomeRules.effectiveMonth(income("Salary", LocalDate.of(2026, 10, 30))));
        }

        @Test
        @DisplayName("an explicit month overrides the credit date (next month's salary paid on the 30th)")
        void explicitMonthWins() {
            Income salary = income("Salary", LocalDate.of(2026, 10, 30));
            salary.setCountsTowardMonth("2026-11");
            assertEquals(YearMonth.of(2026, 11), IncomeRules.effectiveMonth(salary));
        }

        @Test
        @DisplayName("only YYYY-MM is accepted")
        void formatIsStrict() {
            assertThrows(IllegalArgumentException.class, () -> IncomeRules.parseMonth("2026-13"));
            assertThrows(IllegalArgumentException.class, () -> IncomeRules.parseMonth("11/2026"));
            assertThrows(IllegalArgumentException.class, () -> IncomeRules.parseMonth("2026-1"));
            assertEquals(YearMonth.of(2026, 1), IncomeRules.parseMonth("2026-01"));
        }
    }

    @Nested
    @DisplayName("apply — request onto income")
    class Apply {

        @Test
        @DisplayName("sets the kind and a month in the next month")
        void setsKindAndMonth() {
            Income salary = income("Salary", LocalDate.of(2026, 10, 30));
            IncomeRules.apply(salary, request("salary", "2026-11", null));
            assertEquals("SALARY", salary.getKind());
            assertEquals("2026-11", salary.getCountsTowardMonth());
        }

        @Test
        @DisplayName("null leaves existing values alone, so older clients cannot wipe them")
        void nullLeavesUnchanged() {
            Income salary = income("Salary", LocalDate.of(2026, 10, 30));
            salary.setKind("SALARY");
            salary.setCountsTowardMonth("2026-11");
            IncomeRules.apply(salary, request(null, null, null));
            assertEquals("SALARY", salary.getKind());
            assertEquals("2026-11", salary.getCountsTowardMonth());
        }

        @Test
        @DisplayName("blank clears the kind and the month")
        void blankClears() {
            Income salary = income("Salary", LocalDate.of(2026, 10, 30));
            salary.setKind("SALARY");
            salary.setCountsTowardMonth("2026-11");
            IncomeRules.apply(salary, request("", "", null));
            assertNull(salary.getKind());
            assertNull(salary.getCountsTowardMonth());
        }

        @Test
        @DisplayName("a month equal to the credit month is stored as null (it is the default)")
        void sameMonthNormalisedToNull() {
            Income salary = income("Salary", LocalDate.of(2026, 10, 30));
            IncomeRules.apply(salary, request(null, "2026-10", null));
            assertNull(salary.getCountsTowardMonth());
        }

        @Test
        @DisplayName("a month more than 3 months from the credit date is rejected")
        void farMonthRejected() {
            Income salary = income("Salary", LocalDate.of(2026, 10, 30));
            assertThrows(IllegalArgumentException.class, () -> IncomeRules.apply(salary, request(null, "2027-03", null)));
            assertDoesNotThrow(() -> IncomeRules.apply(salary, request(null, "2027-01", null)));
        }

        @Test
        @DisplayName("a stored month that no longer fits after the date was edited is dropped")
        void staleStoredMonthDropped() {
            Income salary = income("Salary", LocalDate.of(2026, 1, 15));
            salary.setCountsTowardMonth("2026-11");
            IncomeRules.apply(salary, request(null, null, null));
            assertNull(salary.getCountsTowardMonth());
        }

        @Test
        @DisplayName("a reimbursement cannot be recurring")
        void reimbursementNotRecurring() {
            Income refund = income("Dinner split", LocalDate.of(2026, 10, 5));
            refund.setIsRecurring(true);
            assertThrows(IllegalArgumentException.class, () -> IncomeRules.apply(refund, request("REIMBURSEMENT", null, null)));
        }

        @Test
        @DisplayName("a reimbursement keeps its category; 0 clears it; negative is rejected")
        void reimbursementCategory() {
            Income refund = income("Dinner split", LocalDate.of(2026, 10, 5));
            IncomeRules.apply(refund, request("REIMBURSEMENT", null, 7L));
            assertEquals(7L, refund.getReimbursedCategoryId());

            IncomeRules.apply(refund, request(null, null, null));
            assertEquals(7L, refund.getReimbursedCategoryId());

            IncomeRules.apply(refund, request(null, null, 0L));
            assertNull(refund.getReimbursedCategoryId());

            assertThrows(IllegalArgumentException.class, () -> IncomeRules.apply(refund, request(null, null, -1L)));
        }

        @Test
        @DisplayName("income that is not a reimbursement never carries a reimbursed category")
        void categoryClearedForOtherKinds() {
            Income salary = income("Salary", LocalDate.of(2026, 10, 30));
            salary.setReimbursedCategoryId(7L);
            IncomeRules.apply(salary, request("SALARY", null, 7L));
            assertNull(salary.getReimbursedCategoryId());
        }
    }

    @Test
    @DisplayName("toDto always reports a concrete kind and month, even for older rows")
    void dtoReportsEffectiveValues() {
        Income old = income("Tech Corp Salary", LocalDate.of(2026, 10, 30));
        IncomeDto dto = IncomeMapper.toDto(old);
        assertEquals("SALARY", dto.kind());
        assertEquals("2026-10", dto.countsTowardMonth());
        assertNull(dto.reimbursedCategoryId());
    }
}

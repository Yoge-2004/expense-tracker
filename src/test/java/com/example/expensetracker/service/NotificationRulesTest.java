package com.example.expensetracker.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("NotificationRules — the thresholds behind each notification")
class NotificationRulesTest {

    private static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }

    @Test
    @DisplayName("budgetLevel: 0 below 80%, 80 from 80%, 100 at or over the limit")
    void budgetLevel() {
        assertEquals(0, NotificationRules.budgetLevel(bd("3999"), bd("5000")));
        assertEquals(80, NotificationRules.budgetLevel(bd("4000"), bd("5000")));
        assertEquals(80, NotificationRules.budgetLevel(bd("4999.99"), bd("5000")));
        assertEquals(100, NotificationRules.budgetLevel(bd("5000"), bd("5000")));
        assertEquals(100, NotificationRules.budgetLevel(bd("9000"), bd("5000")));
    }

    @Test
    @DisplayName("budgetLevel: a missing or non-positive limit never alerts")
    void budgetLevelIgnoresInvalidLimits() {
        assertEquals(0, NotificationRules.budgetLevel(bd("100"), null));
        assertEquals(0, NotificationRules.budgetLevel(bd("100"), BigDecimal.ZERO));
        assertEquals(0, NotificationRules.budgetLevel(null, bd("100")));
    }

    @Test
    @DisplayName("goalMilestone: reports the highest of 25/50/75/100 reached, rounding down")
    void goalMilestone() {
        assertEquals(0, NotificationRules.goalMilestone(bd("2499"), bd("10000")));
        assertEquals(25, NotificationRules.goalMilestone(bd("2500"), bd("10000")));
        assertEquals(50, NotificationRules.goalMilestone(bd("5000"), bd("10000")));
        assertEquals(50, NotificationRules.goalMilestone(bd("7499.99"), bd("10000")));
        assertEquals(75, NotificationRules.goalMilestone(bd("8000"), bd("10000")));
        assertEquals(100, NotificationRules.goalMilestone(bd("12000"), bd("10000")));
        assertEquals(0, NotificationRules.goalMilestone(bd("500"), BigDecimal.ZERO));
        assertEquals(0, NotificationRules.goalMilestone(null, bd("10000")));
    }

    @Test
    @DisplayName("isLargeExpense: needs enough history and at least 3x the average")
    void isLargeExpense() {
        List<BigDecimal> usual = List.of(bd("100"), bd("100"), bd("100"), bd("100"), bd("100"));
        assertTrue(NotificationRules.isLargeExpense(bd("300"), usual));
        assertFalse(NotificationRules.isLargeExpense(bd("299"), usual));
        // four past expenses is not enough to call anything unusual
        assertFalse(NotificationRules.isLargeExpense(bd("5000"), usual.subList(0, 4)));
        assertFalse(NotificationRules.isLargeExpense(null, usual));
    }

    @Test
    @DisplayName("average of nothing is zero; money is grouped and defaults the currency")
    void averageAndMoney() {
        assertEquals(BigDecimal.ZERO, NotificationRules.average(List.of()));
        assertEquals(bd("150.00"), NotificationRules.average(List.of(bd("100"), bd("200"))));
        assertEquals("INR 1,200", NotificationRules.money("INR", bd("1200")));
        assertEquals("INR 5", NotificationRules.money(null, bd("5")));
    }
}

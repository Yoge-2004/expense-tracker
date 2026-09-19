package com.example.expensetracker.mapper;

import com.example.expensetracker.dto.IncomeDto;
import com.example.expensetracker.dto.IncomeRequest;
import com.example.expensetracker.model.Income;
import com.example.expensetracker.model.User;

/**
 * Mapping utility converting between {@link Income} domain models and DTOs.
 *
 * @author Yogeshwaran
 */
public final class IncomeMapper {

    private IncomeMapper() {}

    /**
     * Transforms an {@link Income} entity into an {@link IncomeDto}.
     *
     * @param income the entity to map, or null
     * @return the mapped {@link IncomeDto}, or null if input was null
     */
    public static IncomeDto toDto(Income income) {
        if (income == null) {
            return null;
        }

        return new IncomeDto(
                income.getId(),
                income.getAmount(),
                income.getSource(),
                income.getDescription(),
                income.getIncomeDate(),
                income.getIsRecurring(),
                income.getCreatedAt(),
                income.getFrequency(),
                income.getIntervalDays(),
                income.getNextDueDate()
        );
    }

    /**
     * Transforms an {@link IncomeRequest} DTO into an {@link Income} entity for persistence.
     *
     * @param request the request DTO containing income fields
     * @param user the owning user entity
     * @return the populated {@link Income} entity, or null if request was null
     */
    public static Income toEntity(IncomeRequest request, User user) {
        if (request == null) {
            return null;
        }

        Income income = new Income();
        income.setAmount(request.amount());
        income.setSource(request.source());
        income.setDescription(request.description());
        income.setIncomeDate(request.incomeDate());
        income.setIsRecurring(request.isRecurring());
        income.setFrequency(request.frequency());
        income.setIntervalDays(request.intervalDays());
        income.setUser(user);
        return income;
    }
}

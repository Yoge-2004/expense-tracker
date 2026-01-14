package com.example.expensetracker.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ExpenseDto {

    private Long id;
    private BigDecimal amount;
    private String description;
    private LocalDate expenseDate;
    private Long categoryId;
    private String categoryName;
}

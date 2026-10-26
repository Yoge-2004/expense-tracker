/**
 * JSDoc Type Contracts for ExpenseTracker Pro
 * Defines explicit data shapes exchanged between the Spring Boot REST API and Frontend modules.
 */

/**
 * @typedef {Object} ExpenseDTO
 * @property {number} id - Unique expense identifier
 * @property {number} userId - Owner user ID
 * @property {number} amount - Expense amount in user's currency
 * @property {string} description - Brief description or vendor name
 * @property {string} expenseDate - ISO date string (YYYY-MM-DD or ISO-8601)
 * @property {number} [categoryId] - Associated category ID
 * @property {string} [categoryName] - Name of category (e.g. "Food & Dining")
 * @property {boolean} [isRecurring] - Whether expense repeats automatically
 * @property {string} [recurringFrequency] - Frequency enum: "DAILY"|"WEEKLY"|"MONTHLY"|"YEARLY"|"CUSTOM"
 * @property {number} [recurringIntervalDays] - Interval in days if frequency is CUSTOM
 * @property {string} [createdAt] - Creation timestamp
 */

/**
 * @typedef {Object} IncomeDTO
 * @property {number} id - Unique income stream identifier
 * @property {number} userId - Owner user ID
 * @property {number} amount - Inflow amount
 * @property {string} source - Source label (e.g. "Salary", "Freelance", "Investment")
 * @property {string} incomeDate - ISO date string (YYYY-MM-DD)
 * @property {string} [countsTowardMonth] - Month key (YYYY-MM)
 * @property {string} [cadence] - Frequency enum: "MONTHLY"|"BIWEEKLY"|"WEEKLY"|"ONE_TIME"
 * @property {string} [description] - Optional notes
 * @property {string} [createdAt] - Creation timestamp
 */

/**
 * @typedef {Object} BudgetDTO
 * @property {number} id - Budget identifier
 * @property {number} userId - Owner user ID
 * @property {number} categoryId - Target category ID
 * @property {string} categoryName - Category name
 * @property {number} limit - Spending limit amount
 * @property {number} spent - Current actual spent amount in period
 * @property {string} period - "MONTHLY"|"WEEKLY"|"CUSTOM"
 * @property {string} [startDate] - Start date for custom period
 * @property {string} [endDate] - End date for custom period
 */

/**
 * @typedef {Object} SavingsGoalDTO
 * @property {number} id - Goal identifier
 * @property {number} userId - Owner user ID
 * @property {string} name - Goal title (e.g. "Emergency Fund")
 * @property {number} targetAmount - Target savings total
 * @property {number} currentAmount - Current accumulated amount
 * @property {string} [targetDate] - Target deadline date
 * @property {string} status - "IN_PROGRESS"|"COMPLETED"|"ARCHIVED"
 * @property {string} [frequency] - Contribution cadence
 * @property {number} [intervalDays] - Contribution interval days
 */

/**
 * @typedef {Object} LoanAdjustmentDTO
 * @property {number} id - Loan identifier
 * @property {number} userId - Owner user ID
 * @property {string} counterparty - Friend/lender name
 * @property {number} amount - Principal amount
 * @property {string} type - "LENT"|"BORROWED"
 * @property {string} status - "PENDING"|"SETTLED"
 * @property {string} [notes] - Notes or reference to original expense
 * @property {number} [expenseId] - Linked expense ID if split
 * @property {string} loanDate - Transaction date
 */

/**
 * @typedef {Object} NotificationItemDTO
 * @property {string} id - Notification UUID or ID
 * @property {string} title - Heading
 * @property {string} body - Message body
 * @property {string} [route] - In-app navigation destination ("budgets"|"goals")
 * @property {boolean} read - Whether user has marked read
 * @property {string} createdAt - ISO timestamp
 */

/**
 * @typedef {Object} AuthResponseDTO
 * @property {string} token - JWT Bearer token
 * @property {number} userId - User ID
 * @property {string} email - User email address
 * @property {string} name - Full display name
 * @property {string} [username] - Unique username handle
 * @property {string} [role] - "ROLE_USER"|"ROLE_ADMIN"|"ROLE_SUPER_ADMIN"
 * @property {string} [currency] - ISO currency code (e.g. "INR", "USD")
 * @property {string} [profilePictureUrl] - Avatar image URL
 */

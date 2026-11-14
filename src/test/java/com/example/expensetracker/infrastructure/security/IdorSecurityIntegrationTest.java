package com.example.expensetracker.infrastructure.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.expensetracker.domain.expense.model.Category;
import com.example.expensetracker.domain.expense.repository.CategoryRepository;
import com.example.expensetracker.domain.user.model.Role;
import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.domain.user.repository.UserRepository;



/**
 * Enterprise IDOR (Insecure Direct Object Reference) and Cross-Tenant Data Isolation Test.
 * Proves that users are strictly quarantined within their own ledgers and cannot read,
 * create, export, or mutate another user's financial assets.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class IdorSecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private JwtService jwtService;

    private User victimUser;
    private User attackerUser;
    private User adminUser;
    private Category victimCategory;

    private String victimToken;
    private String attackerToken;
    private String adminToken;

    @BeforeEach
    void setUp() {
        long ts = System.currentTimeMillis();

        victimUser = userRepository.save(User.builder()
                .name("Victim User")
                .username("victim_" + ts)
                .email("victim_" + ts + "@test.com")
                .password("SecurePass123!")
                .role(Role.ROLE_USER)
                .enabled(true)
                .build());

        victimCategory = categoryRepository.save(Category.builder()
                .name("Victim Groceries " + ts)
                .user(victimUser)
                .build());

        attackerUser = userRepository.save(User.builder()
                .name("Attacker User")
                .username("attacker_" + ts)
                .email("attacker_" + ts + "@test.com")
                .password("SecurePass123!")
                .role(Role.ROLE_USER)
                .enabled(true)
                .build());

        adminUser = userRepository.save(User.builder()
                .name("Admin User")
                .username("admin_idor_" + ts)
                .email("admin_idor_" + ts + "@test.com")
                .password("SecurePass123!")
                .role(Role.ROLE_ADMIN)
                .enabled(true)
                .build());

        victimToken = jwtService.generateToken(victimUser.getEmail());
        attackerToken = jwtService.generateToken(attackerUser.getEmail());
        adminToken = jwtService.generateToken(adminUser.getEmail());
    }

    @Test
    @DisplayName("Attacker cannot read victim's expenses (IDOR Prevention)")
    void attackerCannotReadVictimExpenses_returns403() throws Exception {
        mockMvc.perform(get("/api/expenses/user/" + victimUser.getId())
                        .header("Authorization", "Bearer " + attackerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Attacker cannot create an expense billed to victim")
    void attackerCannotCreateExpenseForVictim_returns403() throws Exception {
        String payload = String.format("""
                {
                    "amount": 99.99,
                    "description": "Unauthorized dinner",
                    "expenseDate": "2026-11-14",
                    "categoryId": %d
                }
                """, victimCategory.getId());

        mockMvc.perform(post("/api/expenses/user/" + victimUser.getId())
                        .header("Authorization", "Bearer " + attackerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Attacker cannot read victim's incomes (IDOR Prevention)")
    void attackerCannotReadVictimIncomes_returns403() throws Exception {
        mockMvc.perform(get("/api/incomes/user/" + victimUser.getId())
                        .header("Authorization", "Bearer " + attackerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Attacker cannot create an income under victim's identity")
    void attackerCannotCreateIncomeForVictim_returns403() throws Exception {
        String payload = """
                {
                    "amount": 5000.00,
                    "source": "Malicious Transfer",
                    "incomeDate": "2026-11-14"
                }
                """;

        mockMvc.perform(post("/api/incomes/user/" + victimUser.getId())
                        .header("Authorization", "Bearer " + attackerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Attacker cannot read victim's budget status")
    void attackerCannotReadVictimBudgets_returns403() throws Exception {
        mockMvc.perform(get("/api/expenses/budget/status/user/" + victimUser.getId())
                        .header("Authorization", "Bearer " + attackerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Attacker cannot manipulate victim's budget cap")
    void attackerCannotSetBudgetForVictim_returns403() throws Exception {
        String payload = String.format("""
                {
                    "categoryId": %d,
                    "limitAmount": 1000.00,
                    "period": "MONTHLY"
                }
                """, victimCategory.getId());

        mockMvc.perform(post("/api/expenses/budget/user/" + victimUser.getId())
                        .header("Authorization", "Bearer " + attackerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Attacker cannot read victim's savings goals")
    void attackerCannotReadVictimSavingsGoals_returns403() throws Exception {
        mockMvc.perform(get("/api/savings/goals/user/" + victimUser.getId())
                        .header("Authorization", "Bearer " + attackerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Attacker cannot export victim's expenses to CSV")
    void attackerCannotExportVictimCsv_returns403() throws Exception {
        mockMvc.perform(get("/api/expenses/user/" + victimUser.getId() + "/export/csv")
                        .header("Authorization", "Bearer " + attackerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Attacker cannot export victim's expenses to PDF")
    void attackerCannotExportVictimPdf_returns403() throws Exception {
        mockMvc.perform(get("/api/expenses/user/" + victimUser.getId() + "/export/pdf")
                        .header("Authorization", "Bearer " + attackerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Attacker cannot export victim's expenses to Excel")
    void attackerCannotExportVictimExcel_returns403() throws Exception {
        mockMvc.perform(get("/api/expenses/user/" + victimUser.getId() + "/export/excel")
                        .header("Authorization", "Bearer " + attackerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Attacker cannot export victim's incomes to CSV")
    void attackerCannotExportVictimIncomesCsv_returns403() throws Exception {
        mockMvc.perform(get("/api/incomes/user/" + victimUser.getId() + "/export/csv")
                        .header("Authorization", "Bearer " + attackerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Attacker cannot export victim's financial statement")
    void attackerCannotExportVictimFinancialStatement_returns403() throws Exception {
        mockMvc.perform(get("/api/reports/user/" + victimUser.getId() + "/export/excel")
                        .header("Authorization", "Bearer " + attackerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Victim can successfully access own ledger")
    void victimCanAccessOwnLedger_returns200() throws Exception {
        mockMvc.perform(get("/api/expenses/user/" + victimUser.getId())
                        .header("Authorization", "Bearer " + victimToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Admin can legitimately inspect victim ledger for support / compliance")
    void adminCanInspectVictimLedger_returns200() throws Exception {
        mockMvc.perform(get("/api/expenses/user/" + victimUser.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }
}

package com.example.expensetracker.service.impl;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AdminSystemOpsServiceImplTest {

    @Test
    void csvCellsThatLookLikeFormulasAreNeutralised() {
        assertEquals("\"'=HYPERLINK(\"\"http://x\"\")\"", AdminSystemOpsServiceImpl.escapeCsv("=HYPERLINK(\"http://x\")"));
        assertEquals("\"'+1+1\"", AdminSystemOpsServiceImpl.escapeCsv("+1+1"));
        assertEquals("\"'-2+3\"", AdminSystemOpsServiceImpl.escapeCsv("-2+3"));
        assertEquals("\"'@SUM(A1)\"", AdminSystemOpsServiceImpl.escapeCsv("@SUM(A1)"));
    }

    @Test
    void ordinaryCsvCellsAreOnlyQuoted() {
        assertEquals("\"Reset PIN for user\"", AdminSystemOpsServiceImpl.escapeCsv("Reset PIN for user"));
        assertEquals("\"say \"\"hi\"\"\"", AdminSystemOpsServiceImpl.escapeCsv("say \"hi\""));
        assertEquals("\"\"", AdminSystemOpsServiceImpl.escapeCsv(null));
    }

    @Test
    void lineBreaksCannotStartANewCsvRow() {
        assertEquals("\"a b c\"", AdminSystemOpsServiceImpl.escapeCsv("a\nb\rc"));
    }

    @Test
    void jdbcUrlLosesCredentialsAndOptions() {
        assertEquals("jdbc:postgresql://ep-x.neon.tech/db",
                AdminSystemOpsServiceImpl.maskJdbcUrl("jdbc:postgresql://ep-x.neon.tech/db?user=u&password=secret&sslmode=require"));
        assertEquals("jdbc:postgresql://ep-x.neon.tech/db",
                AdminSystemOpsServiceImpl.maskJdbcUrl("jdbc:postgresql://user:secret@ep-x.neon.tech/db"));
        assertEquals("jdbc:h2:file:./data/expense", AdminSystemOpsServiceImpl.maskJdbcUrl("jdbc:h2:file:./data/expense;MODE=PostgreSQL"));
        assertEquals("", AdminSystemOpsServiceImpl.maskJdbcUrl(null));
    }
}

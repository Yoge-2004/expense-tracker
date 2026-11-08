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

    @Test
    void collapseTqdmProgress_multipleEntriesCollapsedToSingleEntry() {
        String log = """
                [2026-11-07T12:00:00Z] [INFO] Starting training loop...
                [2026-11-07T12:00:01Z] 10%|#         | 10/100 [00:01<00:09, 9.87it/s]
                [2026-11-07T12:00:02Z] 20%|##        | 20/100 [00:02<00:08, 9.85it/s]
                [2026-11-07T12:00:03Z] 30%|###       | 30/100 [00:03<00:07, 9.84it/s]
                [2026-11-07T12:00:10Z] 100%|##########| 100/100 [00:10<00:00, 10.0it/s]
                [2026-11-07T12:00:11Z] [INFO] Training complete!
                """;
        String collapsed = AdminMlGovernanceServiceImpl.collapseTqdmProgress(log);
        String[] lines = collapsed.trim().split("\n");
        assertEquals(3, lines.length);
        assertEquals("[2026-11-07T12:00:00Z] [INFO] Starting training loop...", lines[0].trim());
        assertEquals("[2026-11-07T12:00:10Z] 100%|##########| 100/100 [00:10<00:00, 10.0it/s]", lines[1].trim());
        assertEquals("[2026-11-07T12:00:11Z] [INFO] Training complete!", lines[2].trim());
    }
}

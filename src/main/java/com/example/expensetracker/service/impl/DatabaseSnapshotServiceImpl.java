package com.example.expensetracker.service.impl;

import com.example.expensetracker.service.DatabaseSnapshotService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import javax.sql.DataSource;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.sql.*;
import java.util.*;

/**
 * Implementation of DatabaseSnapshotService that creates/imports a portable SQLite snapshot
 * and protects it with AES-256-GCM.
 */
@Slf4j
@Service
public class DatabaseSnapshotServiceImpl implements DatabaseSnapshotService {
    private static final byte[] MAGIC = {'E','T','D','B','1'};
    private static final int ITERATIONS = 600_000;
    private static final int KEY_BITS = 256;
    private static final int SALT_LENGTH = 16;
    private static final int IV_LENGTH = 12;
    private final DataSource dataSource;
    private final String fallbackDbPath;

    public DatabaseSnapshotServiceImpl(DataSource dataSource,
                                       @Value("${app.fallback-db-path:${DATA_DIR:/data}/expensetracker_fallback}") String fallbackDbPath) {
        this.dataSource = dataSource;
        this.fallbackDbPath = fallbackDbPath;
    }

    @Override
    public int exportCurrentDatabase(Path sqliteFile) throws Exception {
        log.info("Starting export of current database to SQLite snapshot: {}", sqliteFile);
        Files.deleteIfExists(sqliteFile);
        Class.forName("org.sqlite.JDBC");
        int rows = 0;
        try (Connection source = dataSource.getConnection();
             Connection target = DriverManager.getConnection("jdbc:sqlite:" + sqliteFile.toAbsolutePath())) {
            target.setAutoCommit(false);
            for (String table : tableNames(source)) {
                List<Column> columns = columns(source, table);
                createTable(target, table, columns);
                rows += copyRows(source, target, table, columns);
            }
            target.commit();
        }
        log.info("Exported {} rows into SQLite snapshot {}", rows, sqliteFile);
        return rows;
    }

    /** Imports the repository snapshot into the dedicated local H2 failover store, never into Neon. */
    @Override
    public int importIntoFallback(Path sqliteFile) throws Exception {
        log.info("Importing SQLite snapshot into fallback database: {}", sqliteFile);
        Class.forName("org.sqlite.JDBC");
        int rows = 0;
        Path path = Path.of(fallbackDbPath).toAbsolutePath();
        Path parent = path.getParent();
        if (parent != null) Files.createDirectories(parent);
        String h2Url = "jdbc:h2:file:" + path + ";MODE=PostgreSQL;AUTO_SERVER=TRUE";
        try (Connection source = DriverManager.getConnection("jdbc:sqlite:" + sqliteFile.toAbsolutePath());
             Connection target = DriverManager.getConnection(h2Url, "sa", "")) {
            target.setAutoCommit(false);
            try (Statement s = target.createStatement()) { s.execute("SET REFERENTIAL_INTEGRITY FALSE"); }
            Map<String,String> actualTables = actualTableNames(target);
            for (String sourceTable : tableNames(source)) {
                String targetTable = actualTables.get(sourceTable.toLowerCase(Locale.ROOT));
                if (targetTable == null) continue;
                List<Column> sourceColumns = columns(source, sourceTable);
                Map<String,String> actualColumns = actualColumnNames(target, targetTable);
                List<ColumnPair> common = sourceColumns.stream()
                        .filter(c -> actualColumns.containsKey(c.name.toLowerCase(Locale.ROOT)))
                        .map(c -> new ColumnPair(c.name, actualColumns.get(c.name.toLowerCase(Locale.ROOT))))
                        .toList();
                if (common.isEmpty()) continue;
                try (Statement s = target.createStatement()) { s.executeUpdate("DELETE FROM " + q(targetTable)); }
                rows += insertRows(source, target, sourceTable, targetTable, common);
            }
            try (Statement s = target.createStatement()) { s.execute("SET REFERENTIAL_INTEGRITY TRUE"); }
            target.commit();
        }
        log.info("Imported {} rows into fallback H2 database", rows);
        return rows;
    }

    private int insertRows(Connection source, Connection target, String sourceTable, String targetTable, List<ColumnPair> columns) throws SQLException {
        String names = String.join(",", columns.stream().map(c -> q(c.target)).toList());
        String placeholders = String.join(",", Collections.nCopies(columns.size(), "?"));
        int rows = 0;
        String sql = "INSERT INTO " + q(targetTable) + " (" + names + ") VALUES (" + placeholders + ")";
        try (PreparedStatement p = target.prepareStatement(sql);
             Statement s = source.createStatement();
             ResultSet rs = s.executeQuery("SELECT * FROM " + q(sourceTable))) {
            while (rs.next()) {
                for (int i = 0; i < columns.size(); i++) p.setObject(i + 1, normalize(rs.getObject(columns.get(i).source)));
                p.executeUpdate();
                rows++;
            }
        }
        return rows;
    }

    private Object normalize(Object value) {
        if (value instanceof java.sql.Timestamp ts) return ts.toString();
        if (value instanceof java.sql.Date d) return d.toString();
        return value;
    }

    private int copyRows(Connection source, Connection target, String table, List<Column> columns) throws SQLException {
        String names = String.join(",", columns.stream().map(c -> q(c.name)).toList());
        String placeholders = String.join(",", Collections.nCopies(columns.size(), "?"));
        int rows = 0;
        String sql = "INSERT INTO " + q(table) + " (" + names + ") VALUES (" + placeholders + ")";
        try (PreparedStatement p = target.prepareStatement(sql);
             Statement s = source.createStatement();
             ResultSet rs = s.executeQuery("SELECT * FROM " + q(table))) {
            while (rs.next()) {
                for (int i = 0; i < columns.size(); i++) p.setObject(i + 1, rs.getObject(columns.get(i).name));
                p.executeUpdate();
                rows++;
            }
        }
        return rows;
    }

    private void createTable(Connection target, String table, List<Column> columns) throws SQLException {
        List<String> defs = new ArrayList<>();
        List<String> pks = new ArrayList<>();
        for (Column c : columns) {
            defs.add(q(c.name) + " " + sqliteType(c.jdbcType));
            if (c.pk) pks.add(q(c.name));
        }
        if (!pks.isEmpty()) defs.add("PRIMARY KEY (" + String.join(",", pks) + ")");
        try (Statement s = target.createStatement()) {
            s.execute("CREATE TABLE " + q(table) + " (" + String.join(",", defs) + ")");
        }
    }

    private String sqliteType(int jdbcType) {
        return switch (jdbcType) {
            case Types.INTEGER, Types.SMALLINT, Types.TINYINT, Types.BIGINT -> "INTEGER";
            case Types.FLOAT, Types.REAL, Types.DOUBLE, Types.NUMERIC, Types.DECIMAL -> "NUMERIC";
            case Types.BLOB, Types.BINARY, Types.VARBINARY -> "BLOB";
            default -> "TEXT";
        };
    }

    private List<String> tableNames(Connection conn) throws SQLException {
        List<String> tables = new ArrayList<>();
        DatabaseMetaData md = conn.getMetaData();
        String currentSchema = conn.getSchema();
        try (ResultSet rs = md.getTables(conn.getCatalog(), currentSchema, "%", new String[]{"TABLE"})) {
            while (rs.next()) {
                String schem = rs.getString("TABLE_SCHEM");
                if (schem != null && !schem.equalsIgnoreCase("PUBLIC") && (currentSchema != null && !schem.equalsIgnoreCase(currentSchema))) {
                    continue;
                }
                String name = rs.getString("TABLE_NAME");
                String lower = name.toLowerCase(Locale.ROOT);
                if (!lower.startsWith("flyway") && !lower.startsWith("pg_") && !lower.startsWith("sql_")) {
                    tables.add(name);
                }
            }
        }
        return tables;
    }

    private List<Column> columns(Connection conn, String table) throws SQLException {
        List<Column> list = new ArrayList<>();
        Set<String> pks = primaryKeys(conn, table);
        DatabaseMetaData md = conn.getMetaData();
        String currentSchema = conn.getSchema();
        try (ResultSet rs = md.getColumns(conn.getCatalog(), currentSchema, table, "%")) {
            while (rs.next()) {
                String name = rs.getString("COLUMN_NAME");
                list.add(new Column(name, rs.getInt("DATA_TYPE"), pks.contains(name)));
            }
        }
        return list;
    }

    private Set<String> primaryKeys(Connection conn, String table) throws SQLException {
        Set<String> set = new HashSet<>();
        DatabaseMetaData md = conn.getMetaData();
        String currentSchema = conn.getSchema();
        try (ResultSet rs = md.getPrimaryKeys(conn.getCatalog(), currentSchema, table)) {
            while (rs.next()) set.add(rs.getString("COLUMN_NAME"));
        }
        return set;
    }

    private Map<String,String> actualTableNames(Connection conn) throws SQLException {
        Map<String,String> map = new HashMap<>();
        DatabaseMetaData md = conn.getMetaData();
        String currentSchema = conn.getSchema();
        try (ResultSet rs = md.getTables(conn.getCatalog(), currentSchema, "%", new String[]{"TABLE"})) {
            while (rs.next()) {
                String schem = rs.getString("TABLE_SCHEM");
                if (schem != null && !schem.equalsIgnoreCase("PUBLIC") && (currentSchema != null && !schem.equalsIgnoreCase(currentSchema))) {
                    continue;
                }
                String name = rs.getString("TABLE_NAME");
                map.put(name.toLowerCase(Locale.ROOT), name);
            }
        }
        return map;
    }

    private Map<String,String> actualColumnNames(Connection conn, String table) throws SQLException {
        Map<String,String> result = new HashMap<>();
        DatabaseMetaData md = conn.getMetaData();
        String currentSchema = conn.getSchema();
        try (ResultSet rs = md.getColumns(conn.getCatalog(), currentSchema, table, "%")) {
            while (rs.next()) {
                String name = rs.getString("COLUMN_NAME");
                if (name != null) result.put(name.toLowerCase(Locale.ROOT), name);
            }
        }
        return result;
    }

    private String q(String identifier) { return "\"" + identifier.replace("\"", "\"\"") + "\""; }
    private record Column(String name, int jdbcType, boolean pk) {}
    private record ColumnPair(String source, String target) {}

    public static void encrypt(Path input, Path output, String password) throws Exception {
        byte[] salt = new byte[SALT_LENGTH];
        byte[] iv = new byte[IV_LENGTH];
        SecureRandom random = new SecureRandom();
        random.nextBytes(salt); random.nextBytes(iv);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key(password, salt), new GCMParameterSpec(128, iv));
        byte[] ciphertext = cipher.doFinal(Files.readAllBytes(input));
        try (var out = Files.newOutputStream(output)) { out.write(MAGIC); out.write(salt); out.write(iv); out.write(ciphertext); }
    }

    public static void decrypt(Path input, Path output, String password) throws Exception {
        byte[] all = Files.readAllBytes(input);
        if (all.length < MAGIC.length + SALT_LENGTH + IV_LENGTH + 16) throw new SecurityException("Invalid encrypted database snapshot");
        for (int i = 0; i < MAGIC.length; i++) if (all[i] != MAGIC[i]) throw new SecurityException("Invalid encrypted database snapshot header");
        byte[] salt = Arrays.copyOfRange(all, MAGIC.length, MAGIC.length + SALT_LENGTH);
        byte[] iv = Arrays.copyOfRange(all, MAGIC.length + SALT_LENGTH, MAGIC.length + SALT_LENGTH + IV_LENGTH);
        byte[] ciphertext = Arrays.copyOfRange(all, MAGIC.length + SALT_LENGTH + IV_LENGTH, all.length);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(password, salt), new GCMParameterSpec(128, iv));
        Files.write(output, cipher.doFinal(ciphertext));
    }

    private static SecretKeySpec key(String password, byte[] salt) throws Exception {
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, ITERATIONS, KEY_BITS);
        try { return new SecretKeySpec(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(), "AES"); }
        finally { spec.clearPassword(); }
    }
}

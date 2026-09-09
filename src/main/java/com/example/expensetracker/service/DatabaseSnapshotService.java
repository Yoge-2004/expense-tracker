package com.example.expensetracker.service;

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

/** Creates/imports a portable SQLite snapshot and protects it with AES-256-GCM. */
@Service
public class DatabaseSnapshotService {
    private static final byte[] MAGIC = {'E','T','D','B','1'};
    private static final int ITERATIONS = 600_000;
    private static final int KEY_BITS = 256;
    private static final int SALT_LENGTH = 16;
    private static final int IV_LENGTH = 12;
    private final DataSource dataSource;
    private final String fallbackDbPath;

    public DatabaseSnapshotService(DataSource dataSource,
                                   @Value("${app.fallback-db-path:${DATA_DIR:/data}/expensetracker_fallback}") String fallbackDbPath) {
        this.dataSource = dataSource;
        this.fallbackDbPath = fallbackDbPath;
    }

    public int exportCurrentDatabase(Path sqliteFile) throws Exception {
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
        return rows;
    }

    /** Imports the repository snapshot into the dedicated local H2 failover store, never into Neon. */
    public int importIntoFallback(Path sqliteFile) throws Exception {
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
            for (String table : tableNames(source)) {
                List<Column> sourceColumns = columns(source, table);
                List<String> targetColumns = targetColumns(target, table);
                if (targetColumns.isEmpty()) continue;
                List<String> common = sourceColumns.stream().map(c -> c.name)
                        .filter(c -> targetColumns.contains(c.toLowerCase(Locale.ROOT))).toList();
                if (common.isEmpty()) continue;
                try (Statement s = target.createStatement()) { s.executeUpdate("DELETE FROM " + q(table)); }
                rows += insertRows(source, target, table, common);
            }
            try (Statement s = target.createStatement()) { s.execute("SET REFERENTIAL_INTEGRITY TRUE"); }
            target.commit();
        }
        return rows;
    }

    private int insertRows(Connection source, Connection target, String table, List<String> columns) throws SQLException {
        String names = String.join(",", columns.stream().map(this::q).toList());
        String placeholders = String.join(",", Collections.nCopies(columns.size(), "?"));
        int rows = 0;
        String sql = "INSERT INTO " + q(table) + " (" + names + ") VALUES (" + placeholders + ")";
        try (PreparedStatement p = target.prepareStatement(sql);
             Statement s = source.createStatement();
             ResultSet rs = s.executeQuery("SELECT * FROM " + q(table))) {
            while (rs.next()) {
                for (int i = 0; i < columns.size(); i++) p.setObject(i + 1, normalize(rs.getObject(columns.get(i))));
                p.executeUpdate();
                rows++;
            }
        }
        return rows;
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
                for (int i = 0; i < columns.size(); i++) p.setObject(i + 1, normalize(rs.getObject(i + 1)));
                p.executeUpdate();
                rows++;
            }
        }
        return rows;
    }

    private Object normalize(Object value) throws SQLException {
        if (value == null) return null;
        if (value instanceof UUID) return value.toString();
        if (value instanceof java.sql.Array a) return Objects.toString(a.getArray(), null);
        if (value.getClass().getName().equals("org.postgresql.util.PGobject")) return value.toString();
        if (value instanceof java.time.temporal.TemporalAccessor) return value.toString();
        return value;
    }

    private void createTable(Connection target, String table, List<Column> columns) throws SQLException {
        try (Statement s = target.createStatement()) { s.executeUpdate("DROP TABLE IF EXISTS " + q(table)); }
        String defs = String.join(",", columns.stream().map(c -> q(c.name) + " " + sqliteType(c.jdbcType) + (c.pk ? " PRIMARY KEY" : "")).toList());
        try (Statement s = target.createStatement()) { s.executeUpdate("CREATE TABLE " + q(table) + " (" + defs + ")"); }
    }

    private String sqliteType(int type) {
        return switch (type) {
            case Types.BIGINT, Types.INTEGER, Types.SMALLINT, Types.TINYINT, Types.BOOLEAN, Types.BIT -> "INTEGER";
            case Types.REAL, Types.FLOAT, Types.DOUBLE -> "REAL";
            case Types.BINARY, Types.VARBINARY, Types.LONGVARBINARY, Types.BLOB -> "BLOB";
            case Types.NUMERIC, Types.DECIMAL -> "NUMERIC";
            default -> "TEXT";
        };
    }

    private List<String> tableNames(Connection connection) throws SQLException {
        List<String> result = new ArrayList<>();
        try (ResultSet rs = connection.getMetaData().getTables(null, null, "%", new String[]{"TABLE"})) {
            while (rs.next()) {
                String name = rs.getString("TABLE_NAME");
                if (name != null && !name.equalsIgnoreCase("sqlite_sequence") && !name.startsWith("flyway_")) result.add(name);
            }
        }
        return result;
    }

    private List<Column> columns(Connection connection, String table) throws SQLException {
        Set<String> primaryKeys = new HashSet<>();
        try (ResultSet rs = connection.getMetaData().getPrimaryKeys(null, null, table)) {
            while (rs.next()) primaryKeys.add(rs.getString("COLUMN_NAME").toLowerCase(Locale.ROOT));
        }
        List<Column> result = new ArrayList<>();
        try (ResultSet rs = connection.getMetaData().getColumns(null, null, table, "%")) {
            while (rs.next()) {
                String name = rs.getString("COLUMN_NAME");
                if (name != null) result.add(new Column(name, rs.getInt("DATA_TYPE"), primaryKeys.contains(name.toLowerCase(Locale.ROOT))));
            }
        }
        return result;
    }

    private List<String> targetColumns(Connection connection, String table) throws SQLException {
        List<String> result = new ArrayList<>();
        try (ResultSet rs = connection.getMetaData().getColumns(null, null, table, "%")) {
            while (rs.next()) result.add(rs.getString("COLUMN_NAME").toLowerCase(Locale.ROOT));
        }
        return result;
    }

    private String q(String identifier) { return "\"" + identifier.replace("\"", "\"\"") + "\""; }
    private record Column(String name, int jdbcType, boolean pk) {}

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

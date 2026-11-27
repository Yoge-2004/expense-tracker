package com.example.expensetracker.infrastructure.resilience;

import com.example.expensetracker.infrastructure.resilience.FallbackSchemaManager.Col;
import com.example.expensetracker.infrastructure.resilience.FallbackSchemaManager.Tbl;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Pure row reading, canonical formatting, SHA-256 baseline hashing, and conflict payload
 * serialization helpers for {@link FallbackSyncEngine}.
 */
final class FallbackRowCodec {

    private static final String SEP = "\u001f";
    private static final String NULL_MARK = "\u0000";
    private static final int MAX_KEY_LENGTH = 900;

    private FallbackRowCodec() {}

    static List<String> hashedColumns(Tbl t) {
        List<String> names = new ArrayList<>();
        for (Col c : t.cols()) {
            names.add(c.lower());
        }
        names.sort(Comparator.naturalOrder());
        return names;
    }

    static Map<String, Object> readRow(ResultSet rs, Tbl t) throws SQLException {
        Map<String, Object> values = new LinkedHashMap<>();
        for (Col c : t.cols()) {
            int idx = rs.findColumn(c.name());
            Object v = switch (c.type()) {
                case Types.CLOB, Types.NCLOB -> rs.getString(idx);
                case Types.BLOB, Types.BINARY, Types.VARBINARY, Types.LONGVARBINARY -> rs.getBytes(idx);
                default -> rs.getObject(idx);
            };
            values.put(c.lower(), v);
        }
        return values;
    }

    static String rowKey(Tbl t, Map<String, Object> values) {
        List<String> parts = new ArrayList<>();
        for (String p : t.pk()) {
            parts.add(canon(values.get(p.toLowerCase(Locale.ROOT))));
        }
        String key = String.join(SEP, parts);
        return key.length() > MAX_KEY_LENGTH ? "k:" + sha256(key) : key;
    }

    static String rowHash(List<String> columns, Map<String, Object> values) {
        StringBuilder sb = new StringBuilder();
        for (String c : columns) {
            sb.append(canon(values.get(c))).append(SEP);
        }
        return sha256(sb.toString());
    }

    static String canon(Object v) {
        return switch (v) {
            case null -> NULL_MARK;
            case BigDecimal b -> b.signum() == 0 ? "0" : b.stripTrailingZeros().toPlainString();
            case byte[] bytes -> "b:" + Base64.getEncoder().encodeToString(bytes);
            case java.sql.Timestamp ts -> ts.toLocalDateTime().toString();
            case Object obj -> obj.toString();
        };
    }

    static String json(Map<String, Object> values) {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, Object> e : values.entrySet()) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            sb.append('"').append(escape(e.getKey())).append("\":");
            Object v = e.getValue();
            if (v == null) {
                sb.append("null");
            } else {
                sb.append('"').append(escape(canon(v))).append('"');
            }
            if (sb.length() > 90_000) {
                break;
            }
        }
        return sb.append('}').toString();
    }

    static String reason(SQLException e) {
        String message = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage().replaceAll("[\\r\\n]+", " ");
        String state = e.getSQLState() == null ? "" : "[" + e.getSQLState() + "] ";
        return state + message;
    }

    private static String sha256(String text) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(text.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private static String escape(String s) {
        StringBuilder sb = new StringBuilder();
        for (char ch : s.toCharArray()) {
            switch (ch) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (ch < 0x20) {
                        sb.append(String.format("\\u%04x", (int) ch));
                    } else {
                        sb.append(ch);
                    }
                }
            }
        }
        return sb.toString();
    }
}

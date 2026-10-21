package com.example.expensetracker.service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Compares app versions such as {@code 1.0.4} or {@code v1.0.5}. */
public final class AppVersion {

    private static final Pattern VERSION = Pattern.compile("^(\\d{1,9})(?:\\.(\\d{1,9}))?(?:\\.(\\d{1,9}))?");

    private AppVersion() {
    }

    /** True when the text starts with a version number. */
    public static boolean isValid(String version) {
        return parse(version) != null;
    }

    /**
     * True when {@code candidate} is a later version than {@code current}. Text that is not a version never
     * counts as newer, so a malformed release tag can never trigger an update notice.
     */
    public static boolean isNewer(String current, String candidate) {
        long[] a = parse(current);
        long[] b = parse(candidate);
        if (a == null || b == null) {
            return false;
        }
        for (int i = 0; i < 3; i++) {
            if (b[i] != a[i]) {
                return b[i] > a[i];
            }
        }
        return false;
    }

    private static long[] parse(String version) {
        if (version == null) {
            return null;
        }
        String text = version.trim();
        if (text.startsWith("v") || text.startsWith("V")) {
            text = text.substring(1);
        }
        Matcher m = VERSION.matcher(text);
        if (!m.find()) {
            return null;
        }
        long[] parts = new long[3];
        for (int i = 0; i < 3; i++) {
            String group = m.group(i + 1);
            parts[i] = group == null ? 0 : Long.parseLong(group);
        }
        return parts;
    }
}

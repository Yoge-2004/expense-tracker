package com.example.expensetracker.security;

import java.net.InetAddress;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Picks the real client address out of an {@code X-Forwarded-For} chain.
 *
 * <p>Every proxy <em>appends</em> the address it saw, so the left side of the chain is whatever the
 * client chose to send and can be forged freely, while the right side was written by our own
 * infrastructure. The selector therefore reads the chain from the right and returns the first
 * address that is not an internal one (loopback, private, link-local, carrier-grade NAT), which is
 * the first hop outside our proxies. When the number of trusted proxies is known it can be pinned
 * with {@code hops} instead. Pure Java, no DNS lookups: only IP literals are ever parsed.
 *
 * @author Yogeshwaran
 */
public final class ClientIpSelector {

    private static final Pattern IPV4 = Pattern.compile("^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$");
    private static final Pattern IPV6_CHARS = Pattern.compile("^[0-9A-Fa-f:.]+$");

    private ClientIpSelector() {
    }

    /**
     * @param forwardedFor the raw header value, may be null
     * @param hops         number of trusted proxies that append to the chain; {@code 0} means
     *                     "skip internal addresses from the right"
     * @return the client address, or {@code null} when the chain holds nothing usable
     */
    public static String fromForwardedFor(String forwardedFor, int hops) {
        if (forwardedFor == null || forwardedFor.isBlank()) {
            return null;
        }
        List<String> entries = new ArrayList<>();
        for (String part : forwardedFor.split(",")) {
            entries.add(part.trim());
        }

        if (hops > 0) {
            int index = entries.size() - hops;
            if (index < 0) {
                return null;
            }
            String candidate = entries.get(index);
            return isIpLiteral(candidate) ? candidate : null;
        }

        for (int i = entries.size() - 1; i >= 0; i--) {
            String candidate = entries.get(i);
            if (isIpLiteral(candidate) && !isInternal(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    /** True for text that is a plain IPv4 or IPv6 literal (no host names, ports or brackets). */
    public static boolean isIpLiteral(String value) {
        if (value == null || value.isEmpty() || value.length() > 45) {
            return false;
        }
        var v4 = IPV4.matcher(value);
        if (v4.matches()) {
            for (int g = 1; g <= 4; g++) {
                if (Integer.parseInt(v4.group(g)) > 255) {
                    return false;
                }
            }
            return true;
        }
        if (value.indexOf(':') >= 0 && IPV6_CHARS.matcher(value).matches()) {
            try {
                InetAddress.getByName(value); // an IP literal: never triggers a DNS lookup
                return true;
            } catch (Exception e) {
                return false;
            }
        }
        return false;
    }

    /** True for addresses that belong to our own network rather than to an end user. */
    public static boolean isInternal(String ip) {
        try {
            byte[] b = InetAddress.getByName(ip).getAddress();
            if (b.length == 4) {
                int o0 = b[0] & 0xFF;
                int o1 = b[1] & 0xFF;
                return o0 == 0
                        || o0 == 10
                        || o0 == 127
                        || (o0 == 169 && o1 == 254)
                        || (o0 == 172 && o1 >= 16 && o1 <= 31)
                        || (o0 == 192 && o1 == 168)
                        || (o0 == 100 && o1 >= 64 && o1 <= 127)
                        || o0 >= 224;
            }
            int b0 = b[0] & 0xFF;
            int b1 = b[1] & 0xFF;
            boolean unspecifiedOrLoopback = true;
            for (int i = 0; i < 15; i++) {
                if (b[i] != 0) {
                    unspecifiedOrLoopback = false;
                    break;
                }
            }
            return unspecifiedOrLoopback && (b[15] == 0 || b[15] == 1)
                    || (b0 & 0xFE) == 0xFC
                    || (b0 == 0xFE && (b1 & 0xC0) == 0x80);
        } catch (Exception e) {
            return true;
        }
    }
}

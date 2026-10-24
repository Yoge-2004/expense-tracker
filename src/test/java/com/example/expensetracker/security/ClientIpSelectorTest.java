package com.example.expensetracker.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ClientIpSelectorTest {

    @Test
    void clientCannotChooseItsOwnAddressByPrependingEntries() {
        // proxies append, so anything on the left was typed by the client
        assertEquals("203.0.113.7", ClientIpSelector.fromForwardedFor("1.1.1.1, 203.0.113.7, 10.0.0.5", 0));
        assertEquals("203.0.113.7", ClientIpSelector.fromForwardedFor("1.1.1.1, 2.2.2.2, 203.0.113.7", 0));
    }

    @Test
    void singleEntryIsUsedWhenPublic() {
        assertEquals("198.51.100.20", ClientIpSelector.fromForwardedFor("198.51.100.20", 0));
    }

    @Test
    void internalHopsAreSkippedFromTheRight() {
        assertEquals("203.0.113.7",
                ClientIpSelector.fromForwardedFor("203.0.113.7, 10.8.0.1, 172.16.4.4, 192.168.1.9, 127.0.0.1", 0));
        assertEquals("203.0.113.7", ClientIpSelector.fromForwardedFor("203.0.113.7, 100.64.0.9, 169.254.1.1", 0));
    }

    @Test
    void onlyInternalAddressesYieldNothing() {
        assertNull(ClientIpSelector.fromForwardedFor("10.0.0.1, 127.0.0.1", 0));
        assertNull(ClientIpSelector.fromForwardedFor("", 0));
        assertNull(ClientIpSelector.fromForwardedFor(null, 0));
    }

    @Test
    void garbageEntriesAreNeverReturned() {
        assertNull(ClientIpSelector.fromForwardedFor("evil.example.com", 0));
        assertNull(ClientIpSelector.fromForwardedFor("999.1.1.1", 0));
        assertNull(ClientIpSelector.fromForwardedFor("1.2.3.4:8080", 0));
        assertEquals("203.0.113.7", ClientIpSelector.fromForwardedFor("not-an-ip, 203.0.113.7", 0));
    }

    @Test
    void ipv6ClientsAreRecognised() {
        assertEquals("2001:db8::7", ClientIpSelector.fromForwardedFor("2001:db8::7, fd00::1", 0));
        assertNull(ClientIpSelector.fromForwardedFor("::1, fe80::1", 0));
    }

    @Test
    void pinnedHopCountReadsFromTheRight() {
        // hops=2: the client entry sits two places from the right
        assertEquals("203.0.113.7", ClientIpSelector.fromForwardedFor("9.9.9.9, 203.0.113.7, 40.40.40.40", 2));
        assertEquals("40.40.40.40", ClientIpSelector.fromForwardedFor("9.9.9.9, 203.0.113.7, 40.40.40.40", 1));
        assertNull(ClientIpSelector.fromForwardedFor("203.0.113.7", 2));
    }

    @Test
    void literalDetection() {
        assertTrue(ClientIpSelector.isIpLiteral("8.8.8.8"));
        assertTrue(ClientIpSelector.isIpLiteral("2001:db8::1"));
        assertFalse(ClientIpSelector.isIpLiteral("8.8.8"));
        assertFalse(ClientIpSelector.isIpLiteral("localhost"));
        assertFalse(ClientIpSelector.isIpLiteral(" "));
    }
}

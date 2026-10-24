package com.example.expensetracker.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.UnknownHostException;

/**
 * Single place that decides which address a request really came from, for rate limiting and
 * for the admin audit trail.
 *
 * <p>Forwarding headers are honoured only when {@code app.trusted-proxy.enabled=true} <em>and</em> the
 * TCP peer is inside {@code app.trusted-proxy.cidrs}; the chain is then read from the right (see
 * {@link ClientIpSelector}) so a client cannot choose its own address by sending the header itself.
 * Set {@code app.trusted-proxy.hops} to pin the exact number of proxies in front of the app.
 *
 * @author Yogeshwaran
 */
@Component
public class ClientIpResolver {

    @Value("${app.trusted-proxy.enabled:false}")
    private boolean trustedProxyEnabled;

    @Value("${app.trusted-proxy.cidrs:127.0.0.1/32,::1/128}")
    private String trustedProxyCidrs;

    @Value("${app.trusted-proxy.hops:0}")
    private int trustedProxyHops;

    public String resolve(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (!trustedProxyEnabled || !isFromTrustedProxy(remoteAddr)) {
            return remoteAddr;
        }

        String picked = ClientIpSelector.fromForwardedFor(request.getHeader("X-Forwarded-For"), trustedProxyHops);
        if (picked == null) {
            String realIp = request.getHeader("X-Real-IP");
            if (realIp != null) {
                realIp = realIp.trim();
                if (ClientIpSelector.isIpLiteral(realIp) && !ClientIpSelector.isInternal(realIp)) {
                    picked = realIp;
                }
            }
        }
        return picked != null ? picked : remoteAddr;
    }

    private boolean isFromTrustedProxy(String remoteAddr) {
        if (remoteAddr == null || remoteAddr.isBlank() || trustedProxyCidrs == null) {
            return false;
        }
        for (String cidr : trustedProxyCidrs.split(",")) {
            String trimmed = cidr.trim();
            if (!trimmed.isEmpty() && isInCidr(remoteAddr, trimmed)) {
                return true;
            }
        }
        return false;
    }

    private boolean isInCidr(String ipStr, String cidr) {
        try {
            String[] parts = cidr.split("/", 2);
            byte[] target = InetAddress.getByName(ipStr).getAddress();
            byte[] network = InetAddress.getByName(parts[0]).getAddress();
            if (target.length != network.length) {
                return false;
            }
            int prefixLength = parts.length > 1 ? Integer.parseInt(parts[1]) : target.length * 8;
            int fullBytes = prefixLength / 8;
            int remainingBits = prefixLength % 8;
            for (int i = 0; i < fullBytes; i++) {
                if (target[i] != network[i]) {
                    return false;
                }
            }
            if (remainingBits > 0) {
                int mask = (0xFF << (8 - remainingBits)) & 0xFF;
                return (target[fullBytes] & mask) == (network[fullBytes] & mask);
            }
            return true;
        } catch (UnknownHostException | NumberFormatException | ArrayIndexOutOfBoundsException e) {
            return false;
        }
    }
}

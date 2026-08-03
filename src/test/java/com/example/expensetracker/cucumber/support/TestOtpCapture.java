package com.example.expensetracker.cucumber.support;

import com.example.expensetracker.service.OtpDeliveryListener;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Only ever registered under the "test" Spring profile (see
 * {@code CucumberSpringConfig}'s {@code @ActiveProfiles("test")}). Records the
 * most recent OTP issued per email so integration tests can submit the real
 * code to {@code PUT /api/auth/reset-password} instead of guessing or
 * scraping logs.
 */
@Component
@Profile("test")
public class TestOtpCapture implements OtpDeliveryListener {

    private final ConcurrentHashMap<String, String> latestOtpByEmail = new ConcurrentHashMap<>();

    @Override
    public void onOtpIssued(String email, String otp) {
        latestOtpByEmail.put(email, otp);
    }

    public String getLatestOtp(String email) {
        return latestOtpByEmail.get(email);
    }
}

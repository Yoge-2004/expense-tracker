package expo.modules.notificationcapture;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class CaptureFilterTest {
  private static final String OWN = "com.yoge.expensetracker";
  private static final String SMS = "com.google.android.apps.messaging";

  private static boolean keep(String pkg, String text) {
    return CaptureFilter.shouldKeep(pkg, OWN, false, false, text);
  }

  @Test public void keepsBankDebit() {
    assertTrue(keep(SMS, "Rs.450.00 debited from A/c XX1234 on 10-11-26 to SWIGGY. UPI Ref 6123"));
  }

  @Test public void keepsRupeeSignUpiPayment() {
    assertTrue(keep("com.google.android.apps.nbu.paisa.user", "Paid \u20B9120 to Chai Point using UPI"));
  }

  @Test public void keepsCredit() {
    assertTrue(keep(SMS, "INR 25,000.00 credited to your a/c XX9876 - salary"));
  }

  @Test public void dropsOtpOnly() {
    assertFalse(keep(SMS, "123456 is your OTP for txn of Rs 500 at Amazon. Do not share."));
  }

  @Test public void keepsDebitThatMentionsOtp() {
    assertTrue(keep(SMS, "Rs 500 debited from a/c XX1234 for Amazon. Never share your OTP."));
  }

  @Test public void dropsTextWithoutAmount() {
    assertFalse(keep(SMS, "Your card has been blocked. Call the bank."));
  }

  @Test public void dropsAmountWithoutTransactionWord() {
    assertFalse(keep(SMS, "Flat Rs 200 off on your next order. Hurry!"));
  }

  @Test public void dropsOwnAppOngoingSummaryAndChatApps() {
    String t = "Rs.450 debited from A/c XX1234 UPI";
    assertFalse(CaptureFilter.shouldKeep(OWN, OWN, false, false, t));
    assertFalse(CaptureFilter.shouldKeep(SMS, OWN, true, false, t));
    assertFalse(CaptureFilter.shouldKeep(SMS, OWN, false, true, t));
    assertFalse(keep("com.whatsapp", t));
    assertFalse(keep("org.telegram.messenger", t));
  }

  @Test public void dropsEmptyAndNull() {
    assertFalse(keep(SMS, null));
    assertFalse(keep(SMS, "   "));
    assertFalse(keep(null, "Rs 5 debited"));
  }

  @Test public void cleanCollapsesWhitespaceAndCaps() {
    assertEquals("a b c", CaptureFilter.clean("  a \n b\t c  "));
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < 1000; i++) sb.append('x');
    assertEquals(CaptureFilter.MAX_TEXT_LENGTH, CaptureFilter.clean(sb.toString()).length());
  }

  @Test public void dedupeKeyIsStableAndCaseInsensitive() {
    assertEquals(CaptureFilter.dedupeKey(SMS, "Rs 5 Debited"), CaptureFilter.dedupeKey(SMS, "rs 5 debited"));
  }
}

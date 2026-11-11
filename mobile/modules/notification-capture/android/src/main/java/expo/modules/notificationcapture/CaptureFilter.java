package expo.modules.notificationcapture;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Privacy filter for captured notifications. Pure Java (no Android classes) so it can be unit-tested
 * locally with JUnit. Only a notification that looks like a money transaction is ever kept; everything
 * else is dropped before it is stored, and nothing is sent off the device.
 */
public final class CaptureFilter {

  /** Hard cap on the stored text, so a long message can never bloat the queue. */
  public static final int MAX_TEXT_LENGTH = 600;

  /** Chat, social and other apps whose notifications are never read. */
  private static final Set<String> IGNORED_PACKAGES = new HashSet<>(Arrays.asList(
      "com.whatsapp", "com.whatsapp.w4b", "org.telegram.messenger", "org.thoughtcrime.securesms",
      "com.instagram.android", "com.facebook.katana", "com.facebook.orca", "com.snapchat.android",
      "com.twitter.android", "com.discord", "com.linkedin.android", "com.reddit.frontpage",
      "com.google.android.gm", "com.microsoft.office.outlook"));

  /** An amount: Rs / Rs. / INR / the rupee sign before a number, or a number followed by Rs / INR. */
  private static final Pattern AMOUNT = Pattern.compile(
      "(?:\\brs\\.?|\\binr|\u20B9)\\s*[0-9]|[0-9]\\s*(?:rs\\b|inr\\b)", Pattern.CASE_INSENSITIVE);

  /** A transaction word. */
  private static final Pattern TRANSACTION_WORD = Pattern.compile(
      "debit|credit|spent|paid|\\bupi\\b|a/c|\\bcard\\b|\\btxn\\b", Pattern.CASE_INSENSITIVE);

  /** Words that show the money actually moved, as opposed to a code or an offer. */
  private static final Pattern MONEY_MOVED = Pattern.compile(
      "debited|credited|spent|paid|withdrawn|received", Pattern.CASE_INSENSITIVE);

  private static final Pattern OTP = Pattern.compile(
      "\\botp\\b|one[- ]time password|verification code", Pattern.CASE_INSENSITIVE);

  private CaptureFilter() {}

  /**
   * @param packageName package that posted the notification
   * @param ownPackage this app's package (its own notifications are ignored)
   * @param ongoing true for a persistent notification (music, navigation, downloads)
   * @param groupSummary true for the summary row of a grouped notification
   * @param text title and body joined together
   */
  public static boolean shouldKeep(String packageName, String ownPackage, boolean ongoing,
                                   boolean groupSummary, String text) {
    if (text == null || text.trim().isEmpty()) return false;
    if (ongoing || groupSummary) return false;
    if (packageName == null) return false;
    if (packageName.equals(ownPackage) || IGNORED_PACKAGES.contains(packageName)) return false;
    if (!AMOUNT.matcher(text).find()) return false;
    if (!TRANSACTION_WORD.matcher(text).find()) return false;
    // A message that is only a one-time code must not be kept.
    if (OTP.matcher(text).find() && !MONEY_MOVED.matcher(text).find()) return false;
    return true;
  }

  /** Collapses whitespace and cuts the text to {@link #MAX_TEXT_LENGTH}. */
  public static String clean(String text) {
    if (text == null) return "";
    String single = text.replaceAll("\\s+", " ").trim();
    return single.length() > MAX_TEXT_LENGTH ? single.substring(0, MAX_TEXT_LENGTH) : single;
  }

  /** Stable key used to drop an identical notification that arrives twice. */
  public static String dedupeKey(String packageName, String cleanedText) {
    String basis = (packageName == null ? "" : packageName) + "|" + cleanedText.toLowerCase(Locale.ROOT);
    return Integer.toHexString(basis.hashCode()) + "-" + cleanedText.length();
  }
}

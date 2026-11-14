package expo.modules.notificationcapture;

import android.app.Notification;
import android.content.ComponentName;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/**
 * Listens for notifications once the user has granted Notification access, and queues only the ones
 * that pass {@link CaptureFilter}. While the app is closed this only queues; the app records the
 * transactions the next time it is opened.
 */
public class TransactionListenerService extends NotificationListenerService {

  @Override
  public void onNotificationPosted(StatusBarNotification sbn) {
    try {
      if (sbn == null || CaptureStore.isPaused(this)) return;
      Notification notification = sbn.getNotification();
      if (notification == null) return;

      boolean ongoing = (notification.flags & Notification.FLAG_ONGOING_EVENT) != 0;
      boolean groupSummary = (notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0;

      String text = joinText(notification.extras);
      String pkg = sbn.getPackageName();
      if (!CaptureFilter.shouldKeep(pkg, getPackageName(), ongoing, groupSummary, text)) return;

      String cleaned = CaptureFilter.clean(text);
      CaptureStore.add(this, CaptureFilter.dedupeKey(pkg, cleaned), cleaned, pkg, sbn.getPostTime());
    } catch (Throwable ignored) {
      // A listener must never crash the system's notification flow.
    }
  }

  @Override
  public void onListenerDisconnected() {
    super.onListenerDisconnected();
    // The system can unbind a listener (low memory, app update); ask to be bound again.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      try {
        NotificationListenerService.requestRebind(new ComponentName(this, TransactionListenerService.class));
      } catch (Throwable ignored) {
        // Rebind is best effort.
      }
    }
  }

  private static String joinText(Bundle extras) {
    if (extras == null) return "";
    StringBuilder sb = new StringBuilder();
    append(sb, extras.getCharSequence(Notification.EXTRA_TITLE));
    append(sb, extras.getCharSequence(Notification.EXTRA_TITLE_BIG));
    append(sb, extras.getCharSequence(Notification.EXTRA_TEXT));
    CharSequence big = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
    if (big != null && !big.toString().contentEquals(sb)) append(sb, big);
    append(sb, extras.getCharSequence(Notification.EXTRA_SUB_TEXT));
    append(sb, extras.getCharSequence(Notification.EXTRA_INFO_TEXT));
    append(sb, extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT));

    // InboxStyle lines
    CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
    if (lines != null) {
      for (CharSequence line : lines) {
        append(sb, line);
      }
    }

    // MessagingStyle messages (Google Messages, Samsung Messages, and SMS apps)
    Object messagesObj = extras.get("android.messages");
    if (messagesObj instanceof Object[]) {
      for (Object msg : (Object[]) messagesObj) {
        if (msg instanceof Bundle) {
          append(sb, ((Bundle) msg).getCharSequence("text"));
        }
      }
    } else if (messagesObj instanceof java.util.List<?>) {
      for (Object msg : (java.util.List<?>) messagesObj) {
        if (msg instanceof Bundle) {
          append(sb, ((Bundle) msg).getCharSequence("text"));
        }
      }
    }

    return sb.toString();
  }

  private static void append(StringBuilder sb, CharSequence part) {
    if (part == null || part.length() == 0) return;
    if (sb.length() > 0) sb.append(' ');
    sb.append(part);
  }
}

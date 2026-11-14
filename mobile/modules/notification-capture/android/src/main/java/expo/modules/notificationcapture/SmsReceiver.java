package expo.modules.notificationcapture;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

/**
 * Catches incoming bank / UPI transaction SMS messages directly so they can be recorded.
 * Uses CaptureFilter to ignore non-financial messages, OTPs, and chat spam.
 */
public class SmsReceiver extends BroadcastReceiver {

  @Override
  public void onReceive(Context context, Intent intent) {
    try {
      if (context == null || intent == null || CaptureStore.isPaused(context)) return;
      if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;

      SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
      if (messages == null || messages.length == 0) return;

      StringBuilder fullBody = new StringBuilder();
      String sender = null;
      long timestamp = System.currentTimeMillis();

      for (SmsMessage msg : messages) {
        if (msg == null) continue;
        if (sender == null) {
          sender = msg.getDisplayOriginatingAddress();
          if (sender == null) sender = msg.getOriginatingAddress();
        }
        String body = msg.getDisplayMessageBody();
        if (body == null) body = msg.getMessageBody();
        if (body != null) fullBody.append(body);
        long ts = msg.getTimestampMillis();
        if (ts > 0) timestamp = ts;
      }

      String text = fullBody.toString();
      if (sender == null) sender = "SMS";

      if (!CaptureFilter.shouldKeep(sender, context.getPackageName(), false, false, text)) return;

      String cleaned = CaptureFilter.clean(text);
      CaptureStore.add(context, CaptureFilter.dedupeKey(sender, cleaned), cleaned, sender, timestamp);
    } catch (Throwable ignored) {
      // BroadcastReceiver must never crash the system SMS flow.
    }
  }
}

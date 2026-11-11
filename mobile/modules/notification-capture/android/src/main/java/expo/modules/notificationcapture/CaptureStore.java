package expo.modules.notificationcapture;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Small on-device queue of captured transaction texts, kept in this app's private SharedPreferences.
 * Capped and de-duplicated. The app drains it when it is opened; nothing leaves the device from here.
 */
final class CaptureStore {
  private static final String PREFS = "notification_capture";
  private static final String KEY_QUEUE = "queue";
  private static final String KEY_PAUSED = "paused";
  static final int MAX_ITEMS = 100;

  private static final Object LOCK = new Object();

  private CaptureStore() {}

  private static SharedPreferences prefs(Context context) {
    return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  static boolean isPaused(Context context) {
    return prefs(context).getBoolean(KEY_PAUSED, false);
  }

  static void setPaused(Context context, boolean paused) {
    prefs(context).edit().putBoolean(KEY_PAUSED, paused).apply();
  }

  private static JSONArray load(Context context) {
    String raw = prefs(context).getString(KEY_QUEUE, null);
    if (raw == null) return new JSONArray();
    try {
      return new JSONArray(raw);
    } catch (JSONException e) {
      return new JSONArray();
    }
  }

  /** Adds a text unless an identical one is already queued; drops the oldest beyond the cap. */
  static void add(Context context, String key, String text, String packageName, long postedAt) {
    synchronized (LOCK) {
      JSONArray current = load(context);
      for (int i = 0; i < current.length(); i++) {
        JSONObject item = current.optJSONObject(i);
        if (item != null && key.equals(item.optString("k"))) return;
      }
      try {
        JSONObject item = new JSONObject();
        item.put("k", key);
        item.put("t", text);
        item.put("p", packageName == null ? "" : packageName);
        item.put("at", postedAt);
        current.put(item);
      } catch (JSONException e) {
        return;
      }
      JSONArray trimmed = current;
      if (current.length() > MAX_ITEMS) {
        trimmed = new JSONArray();
        for (int i = current.length() - MAX_ITEMS; i < current.length(); i++) {
          trimmed.put(current.opt(i));
        }
      }
      prefs(context).edit().putString(KEY_QUEUE, trimmed.toString()).apply();
    }
  }

  static int size(Context context) {
    synchronized (LOCK) {
      return load(context).length();
    }
  }

  /** Returns the queue as a JSON array string and empties it. */
  static String drain(Context context) {
    synchronized (LOCK) {
      JSONArray current = load(context);
      prefs(context).edit().remove(KEY_QUEUE).apply();
      return current.toString();
    }
  }
}

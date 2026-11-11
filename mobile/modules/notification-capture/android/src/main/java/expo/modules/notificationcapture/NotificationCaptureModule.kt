package expo.modules.notificationcapture

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NotificationCaptureModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val component: ComponentName
    get() = ComponentName(context, TransactionListenerService::class.java)

  override fun definition() = ModuleDefinition {
    Name("NotificationCapture")

    /** True once the user has switched on Notification access for this app. */
    Function("isAccessGranted") {
      val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
      enabled.orEmpty().split(":").any { ComponentName.unflattenFromString(it)?.packageName == context.packageName }
    }

    /**
     * Opens Android's Notification access screen, as close to this app's own switch as the device allows.
     * Returns which screen opened: "detail" (our own switch), "list" (the list, our row highlighted) or "app".
     */
    Function("openAccessSettings") {
      openAccessSettings()
    }

    /** Opens this app's App info page (where "Allow restricted settings" lives on sideloaded builds). */
    Function("openAppInfo") {
      startSettings(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName)))
    }

    Function("isPaused") { CaptureStore.isPaused(context) }
    Function("setPaused") { paused: Boolean -> CaptureStore.setPaused(context, paused) }

    /** Number of captured texts waiting for the app. */
    Function("queueSize") { CaptureStore.size(context) }

    /** Returns the captured texts as a JSON array string and empties the queue. */
    Function("drainQueue") { CaptureStore.drain(context) }
  }

  private fun startSettings(intent: Intent): Boolean {
    return try {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      true
    } catch (e: Exception) {
      false
    }
  }

  private fun openAccessSettings(): String {
    val flat = component.flattenToString()

    // Android 11+: straight to this app's own switch.
    if (android.os.Build.VERSION.SDK_INT >= 30) {
      val detail = Intent("android.settings.NOTIFICATION_LISTENER_DETAIL_SETTINGS")
          .putExtra("android.provider.extra.NOTIFICATION_LISTENER_COMPONENT_NAME", flat)
      if (startSettings(detail)) return "detail"
    }

    // Older versions: the list, with our row highlighted.
    val args = Bundle().apply { putString(":settings:fragment_args_key", flat) }
    val list = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
        .putExtra(":settings:fragment_args_key", flat)
        .putExtra(":settings:show_fragment_args", args)
    if (startSettings(list)) return "list"

    startSettings(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName)))
    return "app"
  }
}

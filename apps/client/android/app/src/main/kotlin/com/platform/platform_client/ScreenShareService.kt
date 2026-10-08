package com.platform.platform_client

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Foreground service of type `mediaProjection` that must be running while the
 * app presents its screen in a meeting (Android 10+; mandatory on 14 before
 * the capture starts). Texts arrive already localized from Dart.
 */
class ScreenShareService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopAsForeground()
            stopSelf()
            return START_NOT_STICKY
        }
        val title = intent?.getStringExtra(EXTRA_TITLE).orEmpty()
        val body = intent?.getStringExtra(EXTRA_BODY).orEmpty()
        val notification = buildNotification(title, body)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION,
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            notifyStarted(false)
            stopSelf()
            return START_NOT_STICKY
        }
        // Only now may the capture start (Android 14): answer the Dart call.
        notifyStarted(true)
        return START_NOT_STICKY
    }

    private fun notifyStarted(ok: Boolean) {
        val reply = pendingStart
        pendingStart = null
        reply?.invoke(ok)
    }

    private fun stopAsForeground() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    private fun buildNotification(title: String, body: String): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                manager.createNotificationChannel(
                    NotificationChannel(CHANNEL_ID, title, NotificationManager.IMPORTANCE_LOW),
                )
            }
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setOngoing(true)
            .build()
    }

    companion object {
        /**
         * Answers MainActivity's "start" call once the service runs in the
         * foreground (main thread, single use).
         */
        @Volatile
        var pendingStart: ((Boolean) -> Unit)? = null

        const val ACTION_STOP = "com.platform.platform_client.SCREEN_SHARE_STOP"
        const val EXTRA_TITLE = "title"
        const val EXTRA_BODY = "body"
        private const val CHANNEL_ID = "pon_screen_share"
        private const val NOTIFICATION_ID = 42
    }
}

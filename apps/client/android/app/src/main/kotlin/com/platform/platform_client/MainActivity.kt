package com.platform.platform_client

import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, SCREEN_SHARE_CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "start" -> {
                        val intent = Intent(this, ScreenShareService::class.java)
                            .putExtra(ScreenShareService.EXTRA_TITLE, call.argument<String>("title"))
                            .putExtra(ScreenShareService.EXTRA_BODY, call.argument<String>("body"))
                        // Reply only once the service is in the foreground —
                        // Android 14 refuses a projection started before
                        // that. A service that never reports (3 s) proceeds
                        // as before.
                        var replied = false
                        val reply: (Boolean) -> Unit = { ok ->
                            if (!replied) {
                                replied = true
                                if (ok) result.success(null)
                                else result.error("start_failed", null, null)
                            }
                        }
                        ScreenShareService.pendingStart = reply
                        try {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                startForegroundService(intent)
                            } else {
                                startService(intent)
                            }
                            Handler(Looper.getMainLooper()).postDelayed({
                                if (ScreenShareService.pendingStart === reply) {
                                    ScreenShareService.pendingStart = null
                                }
                                reply(true)
                            }, START_TIMEOUT_MS)
                        } catch (e: Exception) {
                            ScreenShareService.pendingStart = null
                            reply(false)
                        }
                    }
                    "stop" -> {
                        // stopService is safe when the service is not running
                        // and from the background (startService is not).
                        stopService(Intent(this, ScreenShareService::class.java))
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private companion object {
        const val SCREEN_SHARE_CHANNEL = "pon/screen_share"
        const val START_TIMEOUT_MS = 3000L
    }
}

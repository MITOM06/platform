package com.platform.platform_client

import android.content.Intent
import android.os.Build
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
                        try {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                startForegroundService(intent)
                            } else {
                                startService(intent)
                            }
                            result.success(null)
                        } catch (e: Exception) {
                            result.error("start_failed", null, null)
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
    }
}

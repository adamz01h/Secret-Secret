package com.secretco.secret

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.activity.OnBackPressedCallback

class MainActivity : ComponentActivity() {

    // Modern permission launcher (NO deprecation)
    private val cameraPermissionLauncher =
        registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { isGranted ->
            if (isGranted) {
                // Camera permission granted
            } else {
                // Camera permission denied
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Create WebView programmatically
        val webView = WebView(this)
        val db = AppDatabase(this)

        setContentView(webView)

        // Enable debugging (chrome://inspect)
        WebView.setWebContentsDebuggingEnabled(true)

        // WebView settings (REQUIRED)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            mediaPlaybackRequiresUserGesture = false
        }

        // Required for camera access (QR scanning)
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    request.grant(request.resources)
                }
            }
        }

        // JavaScript ↔ Android bridge
        webView.addJavascriptInterface(
            JsBridge(db),
            "AndroidDB"
        )

        // Load offline app
        webView.loadUrl("file:///android_asset/index.html")

        // Request camera permission (modern API)
        if (ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.CAMERA
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            cameraPermissionLauncher.launch(
                Manifest.permission.CAMERA
            )
        }

         // --- Back Button / Gesture Handling ---
        onBackPressedDispatcher.addCallback(this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    webView.evaluateJavascript(
                        "if(document.querySelector('.backBtn')) { document.querySelector('.backBtn').click(); }",
                        null
                    )
                }
            })
    }

}

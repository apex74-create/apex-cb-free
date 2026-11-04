import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Public free build — Sovereign CB, the one product this repo ships
 * (see src/lib/product-builds.ts: appId app.lovable.apexsignal.cb,
 * start path /cb on encryptedcb.com).
 *
 * Thin native shell, same pattern as the private repo's product shells:
 * the APK loads the hosted app from encryptedcb.com. The bundled
 * android-shell/ page is only the fallback shown when the hosted app
 * cannot be reached. No private server logic ships in this bundle —
 * the public source is fail-closed stubs by design.
 */
const config: CapacitorConfig = {
  appId: "app.lovable.apexsignal.cb",
  appName: "Sovereign CB",
  webDir: "android-shell",
  bundledWebRuntime: false,
  backgroundColor: "#000000",
  server: {
    url: "https://encryptedcb.com/cb",
    errorPath: "index.html",
    androidScheme: "https",
    iosScheme: "https",
    cleartext: false,
    allowNavigation: ["encryptedcb.com", "*.encryptedcb.com"],
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#000000",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#000000",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#000000",
    },
  },
};

export default config;

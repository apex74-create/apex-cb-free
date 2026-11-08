package app.lovable.apexsignal.cb;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Receives the vendor/Zello-standard PTT broadcasts. Two registrations use
 * this one class:
 *   - runtime-registered by MainActivity while the app process lives (the
 *     load-bearing path: foreground and backgrounded-but-alive), and
 *   - manifest-declared (best effort: Android only delivers implicit
 *     broadcasts to manifest receivers in narrow cases, e.g. when the sender
 *     targets this package — which is exactly what a vendor layer does once
 *     an app is bound to the key).
 * With no live activity the event is recorded, never acted on blindly.
 */
public class PttKeyReceiver extends BroadcastReceiver {
    private static final String TAG = "ApexPTT";

    public interface Listener {
        void onPttBroadcast(boolean down, String action);
    }

    /** Set by MainActivity on create, cleared on destroy. */
    public static volatile Listener listener;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String a = intent.getAction();
        Boolean down = null;
        if (PttContract.isDownAction(a)) down = Boolean.TRUE;
        else if (PttContract.isUpAction(a)) down = Boolean.FALSE;
        if (down == null) return;
        Log.i(TAG, "ptt broadcast " + a);
        Listener l = listener;
        if (l != null) {
            l.onPttBroadcast(down, a);
        } else {
            new PttKeyStore(context).recordBroadcast(a, down);
        }
    }
}

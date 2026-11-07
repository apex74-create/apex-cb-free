package app.lovable.apexsignal.cb;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * The established assignment, owned by the container (not the WebView):
 * which hardware key is the PTT key, and what each gesture on it does.
 * Stored in SharedPreferences so it survives WebView cache clears and app
 * updates. Once a gesture is assigned here it is established — the container
 * enforces it and no selector is ever consulted for that gesture again.
 */
final class PttKeyStore {
    private static final String PREFS = "apex_ptt";
    private static final String KEY_CODE = "ptt_key_code";
    private static final String BIND_PREFIX = "bind_";
    private static final String LAST_BROADCAST = "last_broadcast";

    private final SharedPreferences prefs;

    PttKeyStore(Context ctx) {
        prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Learned PTT key code, or -1 when the user has not assigned one. */
    int assignedKeyCode() {
        return prefs.getInt(KEY_CODE, -1);
    }

    void setAssignedKeyCode(int code) {
        prefs.edit().putInt(KEY_CODE, code).apply();
    }

    /** Action bound to a gesture ("single" | "double" | "long"). Default: talk. */
    String binding(String gesture) {
        return prefs.getString(BIND_PREFIX + gesture, PttContract.ACTION_TALK);
    }

    void setBinding(String gesture, String action) {
        prefs.edit().putString(BIND_PREFIX + gesture, action).apply();
    }

    void resetBindings() {
        prefs.edit()
            .remove(BIND_PREFIX + "single")
            .remove(BIND_PREFIX + "double")
            .remove(BIND_PREFIX + "long")
            .apply();
    }

    /** A PTT broadcast that arrived with no live activity: kept for the record. */
    void recordBroadcast(String action, boolean down) {
        prefs.edit().putString(LAST_BROADCAST, action + "|" + down + "|" + System.currentTimeMillis()).apply();
    }
}

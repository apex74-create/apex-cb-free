package app.lovable.apexsignal.cb;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.KeyEvent;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Encrypted CB — the container owns the PTT key.
 *
 * The rule (owner, Nov 7 2026): once the user assigns the PTT key inside the
 * app, that key belongs to PTT inside this container, full stop. Key events
 * for it are consumed here at dispatch level — down keys the radio exactly
 * once, auto-repeat is swallowed, up releases, and NO hold of any length
 * escalates to anything else. There is no chooser call in this class and no
 * path from a key event to one.
 *
 * Gestures: single / double / long press are separately assignable in
 * PttKeyStore and enforced by the engine below. Talk starts on the physical
 * down with zero latency; gesture classification refines what a press means
 * without ever delaying the keying. With the default map (every gesture =
 * "talk") behaviour is exactly classic hold-to-talk.
 *
 * Vendor broadcasts (Zello-standard and friends, see PttContract) feed the
 * same engine, so a key the vendor layer delivers as a broadcast behaves
 * identically to one delivered as a key event.
 */
public class MainActivity extends BridgeActivity {
    private static final String TAG = "ApexPTT";

    private PttKeyStore pttStore;
    private PttKeyReceiver pttReceiver;
    private final Handler pttHandler = new Handler(Looper.getMainLooper());

    // --- gesture engine state ---
    private boolean pttDown;
    private boolean pttKeyed;
    private boolean longFired;
    private boolean secondPress;
    private boolean awaitingSingle;
    private int activeKeyCode;
    private Runnable longTimer;
    private Runnable singleTimer;
    private Runnable safetyTimer;

    // --- learn mode (driven by PttKeyPlugin) ---
    private boolean learning;
    private Runnable learnTimeout;

    /** Notified once when learn mode captures a key. Set by PttKeyPlugin. */
    interface LearnCallback { void onLearned(int keyCode); }
    private LearnCallback learnCallback;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PttKeyPlugin.class);
        super.onCreate(savedInstanceState);
        pttStore = new PttKeyStore(this);
        registerPttReceiver();
        PttKeyReceiver.listener = (down, action) -> onPttBroadcast(down);
    }

    // ------------------------------------------------------------------
    // Key events: the container consumes its key, always.
    // ------------------------------------------------------------------

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        if (learning) {
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0
                    && code != KeyEvent.KEYCODE_POWER) {
                finishLearning(code);
            }
            return true; // learn mode swallows the key it is learning, and its neighbours
        }
        if (isPttKeyCode(code)) {
            if (event.getAction() == KeyEvent.ACTION_DOWN) {
                if (event.getRepeatCount() == 0) engineDown(code);
                // repeats are swallowed: a hold never re-fires, never escalates
            } else if (event.getAction() == KeyEvent.ACTION_UP) {
                engineUp(code);
            }
            return true; // consumed — the event goes no further, ever
        }
        return super.dispatchKeyEvent(event);
    }

    private boolean isPttKeyCode(int code) {
        if (pttStore != null && code == pttStore.assignedKeyCode()) return true;
        return PttContract.isKnownKeyCode(code);
    }

    /** A vendor "open app" while CB is already running just brings it forward. */
    @Override
    protected void onNewIntent(Intent intent) {
        if (intent != null && Intent.ACTION_MAIN.equals(intent.getAction())) {
            Log.i(TAG, "relaunch ignored (already open)");
            setIntent(intent);
            return;
        }
        super.onNewIntent(intent);
    }

    // ------------------------------------------------------------------
    // Broadcast path: same engine, source keyCode 0.
    // ------------------------------------------------------------------

    private void onPttBroadcast(boolean down) {
        if (down) {
            bringForward();
            engineDown(0);
        } else {
            engineUp(0);
        }
    }

    private void registerPttReceiver() {
        pttReceiver = new PttKeyReceiver();
        IntentFilter f = new IntentFilter();
        for (String a : PttContract.DOWN_ACTIONS) f.addAction(a);
        for (String a : PttContract.UP_ACTIONS) f.addAction(a);
        try {
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(pttReceiver, f, Context.RECEIVER_EXPORTED);
            else registerReceiver(pttReceiver, f);
        } catch (RuntimeException e) {
            pttReceiver = null;
            Log.w(TAG, "ptt receiver registration failed", e);
        }
    }

    /** Bring the talk surface forward — directly, with no selection step. */
    private void bringForward() {
        try {
            Intent self = new Intent(this, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(self);
        } catch (RuntimeException e) {
            // Background-activity-start limits can refuse this; the keying
            // below still lands when the surface comes forward on its own.
            Log.w(TAG, "bring-forward refused by OS", e);
        }
    }

    // ------------------------------------------------------------------
    // The gesture engine.
    // ------------------------------------------------------------------

    private void engineDown(int code) {
        if (pttDown) return;
        pttDown = true;
        activeKeyCode = code;
        longFired = false;
        secondPress = awaitingSingle;
        if (awaitingSingle) {
            cancelSingleTimer();
            awaitingSingle = false;
        }
        talkDown(); // zero-latency: the radio keys on the physical press
        longTimer = () -> {
            if (!pttDown || longFired) return;
            longFired = true;
            String action = pttStore.binding("long");
            Log.i(TAG, "gesture long -> " + action);
            if (!PttContract.ACTION_TALK.equals(action)) {
                talkUp();
                runAction(action, "long");
            }
            // long == talk: already keyed; stays keyed until physical release.
            // A hold of four seconds or four minutes changes nothing else.
        };
        pttHandler.postDelayed(longTimer, PttContract.LONG_PRESS_MS);
        safetyTimer = () -> { if (pttDown) engineUp(activeKeyCode); };
        pttHandler.postDelayed(safetyTimer, PttContract.MAX_KEY_MS);
    }

    private void engineUp(int code) {
        if (!pttDown) return;
        pttDown = false;
        cancelLongTimer();
        cancelSafetyTimer();
        if (longFired) {
            longFired = false;
            secondPress = false;
            talkUp();
            return;
        }
        talkUp(); // momentary talk always ends with the physical release
        if (secondPress) {
            secondPress = false;
            String action = pttStore.binding("double");
            Log.i(TAG, "gesture double -> " + action);
            if (!PttContract.ACTION_TALK.equals(action)) runAction(action, "double");
            return;
        }
        // Single-tap candidate: the binding is established now, the action
        // fires when the double-tap window closes with no second press.
        awaitingSingle = true;
        singleTimer = () -> {
            awaitingSingle = false;
            String action = pttStore.binding("single");
            Log.i(TAG, "gesture single -> " + action);
            if (!PttContract.ACTION_TALK.equals(action)) runAction(action, "single");
        };
        pttHandler.postDelayed(singleTimer, PttContract.DOUBLE_TAP_MS);
    }

    /** Non-talk actions: built-ins here, everything else goes to the deck. */
    private void runAction(String action, String gesture) {
        if (PttContract.ACTION_NONE.equals(action)) return;
        if (PttContract.ACTION_OPEN.equals(action)) bringForward();
        dispatchGestureEvent(action, gesture);
    }

    private void cancelLongTimer() {
        if (longTimer != null) { pttHandler.removeCallbacks(longTimer); longTimer = null; }
    }

    private void cancelSingleTimer() {
        if (singleTimer != null) { pttHandler.removeCallbacks(singleTimer); singleTimer = null; }
    }

    private void cancelSafetyTimer() {
        if (safetyTimer != null) { pttHandler.removeCallbacks(safetyTimer); safetyTimer = null; }
    }

    // ------------------------------------------------------------------
    // Web forwarding: F24 edges for talk (the deck's proven channel),
    // a CustomEvent for bound gesture actions.
    // ------------------------------------------------------------------

    private void talkDown() {
        if (pttKeyed) return;
        pttKeyed = true;
        evalJs("window.dispatchEvent(new KeyboardEvent('keydown',{code:'F24',key:'F24'}));");
    }

    private void talkUp() {
        if (!pttKeyed) return;
        pttKeyed = false;
        evalJs("window.dispatchEvent(new KeyboardEvent('keyup',{code:'F24',key:'F24'}));");
    }

    private void dispatchGestureEvent(String action, String gesture) {
        try {
            JSONObject detail = new JSONObject();
            detail.put("action", action);
            detail.put("gesture", gesture);
            detail.put("keyCode", activeKeyCode);
            evalJs("window.dispatchEvent(new CustomEvent('apex-ptt-gesture',{detail:" + detail + "}));");
        } catch (JSONException ignored) { }
    }

    private void evalJs(String js) {
        if (getBridge() == null) return;
        final WebView wv = getBridge().getWebView();
        if (wv == null) return;
        wv.post(() -> wv.evaluateJavascript(js, null));
    }

    // ------------------------------------------------------------------
    // Learn mode + store access for PttKeyPlugin.
    // ------------------------------------------------------------------

    PttKeyStore pttStore() { return pttStore; }

    void startLearning(LearnCallback cb) {
        learning = true;
        learnCallback = cb;
        if (learnTimeout != null) pttHandler.removeCallbacks(learnTimeout);
        learnTimeout = () -> finishLearning(-1);
        pttHandler.postDelayed(learnTimeout, 15_000);
    }

    private void finishLearning(int code) {
        if (!learning) return;
        learning = false;
        if (learnTimeout != null) { pttHandler.removeCallbacks(learnTimeout); learnTimeout = null; }
        if (code > 0) {
            pttStore.setAssignedKeyCode(code);
            Log.i(TAG, "learned ptt key " + code);
        }
        LearnCallback cb = learnCallback;
        learnCallback = null;
        if (cb != null) cb.onLearned(code);
    }

    // ------------------------------------------------------------------
    // Lifecycle: never leave the transmitter keyed, never leak the receiver.
    // ------------------------------------------------------------------

    @Override
    public void onPause() {
        super.onPause();
        if (pttDown) engineUp(activeKeyCode);
        if (pttKeyed) talkUp();
    }

    @Override
    public void onDestroy() {
        PttKeyReceiver.listener = null;
        if (pttReceiver != null) {
            try { unregisterReceiver(pttReceiver); } catch (RuntimeException ignored) { }
        }
        super.onDestroy();
    }
}

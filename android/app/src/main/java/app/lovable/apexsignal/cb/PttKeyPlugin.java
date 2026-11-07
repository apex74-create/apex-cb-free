package app.lovable.apexsignal.cb;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The deck's handle on the container's PTT assignment (PttKeyStore).
 * Storage lives natively on purpose: the assignment is the container's,
 * survives WebView cache clears, and the native engine enforces it whether
 * or not the page is currently listening. On the plain web build none of
 * this exists and src/lib/ptt-key.ts falls back to localStorage.
 */
@CapacitorPlugin(name = "PttKey")
public class PttKeyPlugin extends Plugin {

    private MainActivity activity() {
        if (getActivity() instanceof MainActivity) return (MainActivity) getActivity();
        return null;
    }

    private PttKeyStore store(PluginCall call) {
        MainActivity a = activity();
        if (a == null || a.pttStore() == null) {
            call.reject("PTT store unavailable outside the CB shell");
            return null;
        }
        return a.pttStore();
    }

    private JSObject state(PttKeyStore store) {
        JSObject bindings = new JSObject();
        bindings.put("single", store.binding("single"));
        bindings.put("double", store.binding("double"));
        bindings.put("long", store.binding("long"));
        JSObject out = new JSObject();
        out.put("assignedKeyCode", store.assignedKeyCode());
        out.put("bindings", bindings);
        return out;
    }

    @PluginMethod
    public void getState(PluginCall call) {
        PttKeyStore store = store(call);
        if (store != null) call.resolve(state(store));
    }

    @PluginMethod
    public void setBinding(PluginCall call) {
        PttKeyStore store = store(call);
        if (store == null) return;
        String gesture = call.getString("gesture", "");
        String action = call.getString("action", PttContract.ACTION_TALK);
        if (!gesture.equals("single") && !gesture.equals("double") && !gesture.equals("long")) {
            call.reject("unknown gesture: " + gesture);
            return;
        }
        store.setBinding(gesture, action);
        call.resolve(state(store));
    }

    @PluginMethod
    public void setAssignedKey(PluginCall call) {
        PttKeyStore store = store(call);
        if (store == null) return;
        store.setAssignedKeyCode(call.getInt("keyCode", -1));
        call.resolve(state(store));
    }

    @PluginMethod
    public void resetBindings(PluginCall call) {
        PttKeyStore store = store(call);
        if (store == null) return;
        store.resetBindings();
        call.resolve(state(store));
    }

    /**
     * Capture the next hardware key the handset delivers and establish it as
     * the PTT key. Resolves immediately; the captured key arrives as the
     * "keyLearned" event (and in getState).
     */
    @PluginMethod
    public void learnKey(PluginCall call) {
        MainActivity a = activity();
        if (a == null) { call.reject("PTT learning unavailable outside the CB shell"); return; }
        a.startLearning(code -> {
            JSObject out = new JSObject();
            out.put("keyCode", code);
            notifyListeners("keyLearned", out);
        });
        call.resolve();
    }
}

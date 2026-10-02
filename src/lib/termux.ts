/**
 * Typing shell/pkg commands *into* Termux over adb.
 *
 * Termux commands (pkg install, termux-setup-storage, node ...) cannot run as
 * `adb shell` — they need Termux's own prefix/environment. Rather than leaving
 * them as MANUAL steps, we focus the Termux session and post the line as real
 * keystrokes, then press ENTER. Everything below is a genuine adb command.
 */

/** Escape a command line for `input text` (spaces become %s). */
export function escapeInput(cmd: string): string {
  return cmd
    .replace(/(["$`\\])/g, "\\$1")
    .replace(/'/g, "\\'")
    .replace(/ /g, "%s");
}

/** Commands that only make sense inside a Termux session. */
export function isTermuxCommand(cmd: string): boolean {
  return /^(pkg|apt|pip|npm|node|termux-|mkdir|printf|chmod|git|python|sh|bash|rnsd|nohup)\b/.test(
    cmd.trim(),
  );
}

/**
 * Focus Termux, type the line, hit ENTER.
 * `sleep` gives the activity time to take focus on slow AOSP 10 devices.
 */
export function termuxTypeCmd(cmd: string): string {
  const line = escapeInput(cmd);
  return [
    "shell 'am start -n com.termux/.HomeActivity >/dev/null 2>&1;",
    "sleep 2;",
    `input text "${line}";`,
    "sleep 1;",
    "input keyevent 66'",
  ].join(" ");
}

/** Same line, but through the Termux:Tasker RUN_COMMAND API (headless). */
export function termuxRunCommandCmd(cmd: string): string {
  const esc = cmd.replace(/'/g, "'\\''");
  return (
    "shell am startservice --user 0 -n com.termux/com.termux.app.RunCommandService " +
    "-a com.termux.RUN_COMMAND " +
    "--es com.termux.RUN_COMMAND_PATH /data/data/com.termux/files/usr/bin/bash " +
    `--esa com.termux.RUN_COMMAND_ARGUMENTS '-c','${esc}' ` +
    "--ez com.termux.RUN_COMMAND_BACKGROUND false"
  );
}

GPT-5.4 has this to say about migration. (My comments in [...])

==============================================

`src/linux.cpp` is using pure X11/XTest primitives today, so every Linux feature here needs a semantic replacement, not just a transport swap:

```1:4:src/linux.cpp
#include <X11/XKBlib.h>
#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <X11/extensions/XTest.h>
```

## Best Candidates

These can be modernized for Wayland-only systems with a reasonably current stack:

- `Click`, `MouseDown`, `MouseUp`, `PressKey`, `ToggleKey`, `TypeText`, `SetMouseLocation`
  Best modern path: `xdg-desktop-portal` `RemoteDesktop` v2 [See: "XDG Desktop Portal: For modern Wayland sessions, the Remote Desktop portal is the standard method.", e.g.: https://discourse.gnome.org/t/solved-remote-desktop-portal-cannot-simulate-mouse-button-press-on-wayland/21455] plus `ConnectToEIS`/`libei`.
  Fallbacks: older portal `Notify*` methods, wlroots virtual keyboard/pointer protocols, or privileged `uinput` tools like `ydotool`.
  Caveat: this becomes permissioned automation, not silent unrestricted injection.

```443:539:src/linux.cpp
void MouseDown(Display* display, const std::string& button) {
  XTestFakeButtonEvent(display, GetMouseButton(button), true, 0);
  XFlush(display);
  usleep(10000);
}
// ...
void SetMouseLocation(int x, int y) {
  Display* display = XOpenDisplay(NULL);
  XWarpPointer(display, None, XDefaultRootWindow(display), 0, 0, 0, 0, x, y);
  XCloseDisplay(display);
}
```

- `GetEditorState`
  This is the strongest Wayland modernization candidate, but not via X11-style selection tricks. Replace it with AT-SPI accessibility queries against the focused accessible text object:
  use focused object lookup, `Text.get_caret_offset()`, selection APIs, and text retrieval.
  This should work for accessible GTK/Qt/browser/editor apps and has gotten better in recent GTK 4 accessibility work.

## Possible, But Only Partially Portable

These can work on some desktops/compositors, but not as a universal Wayland guarantee:

- `GetActiveApplication`
  Likely yes via AT-SPI focus tracking. This is probably the best cross-desktop answer for “what app is focused?” on Wayland.

- `GetActiveApplicationWindowBounds`
  Sometimes via AT-SPI `Component.get_extents()` on the focused top-level accessible, or via compositor-specific APIs.
  Caveat: this is not the same thing as universal compositor/window-manager geometry, so expect inconsistencies.

- `GetRunningApplications`
  Partial options exist:
  AT-SPI desktop enumeration, wlroots `ext-foreign-toplevel-list`, GNOME Shell DBus/extensions, KWin scripting/DBus.
  There is still no single Wayland-wide “list all windows/apps” API like `_NET_CLIENT_LIST`.

- `FocusApplication`
  Only partly modernizable.
  Wayland intentionally prevents arbitrary focus stealing. `xdg-activation` helps when you have a valid activation token and app cooperation, but it is not a drop-in replacement for “focus any window by name.”
  On GNOME/KDE you may get this via shell/compositor-specific scripting or extensions, but not portably.

```29:109:src/linux.cpp
void FocusApplication(const std::string& application) {
  Display* display = XOpenDisplay(NULL);
  std::vector<Window> windows = GetAllWindows(display);
  for (Window window : windows) {
    std::string name = ProcessName(display, window);
    if (name.find(application) != std::string::npos) {
      XClientMessageEvent event;
      // ...
      event.message_type =
          XInternAtom(display, std::string("_NET_ACTIVE_WINDOW").c_str(), 1);
      // ...
```

## Poor Or No Portable Wayland Replacement

These are the ones I would not expect to survive as-is on Wayland-only distros:

- `GetMouseLocation`
  No good cross-desktop global cursor-position API exists in Wayland by design.
  You can sometimes know pointer position inside a portal/EIS session or through compositor-specific scripting, but not via a general unrestricted query.

- `GetClipboard`
  As a global out-of-process clipboard read, this is weak on Wayland.
  Portal clipboard work exists, but it is session-based and still not the kind of universal silent clipboard access this code assumes.

- `GetEditorStateFallback`
  As implemented, this is a bad fit for Wayland because it depends on synthetic selection changes plus clipboard reads.
  On Wayland, the right move is to replace this fallback with AT-SPI-based text/caret inspection, not port the current method.

```179:204:src/linux.cpp
std::tuple<std::string, int, bool> GetEditorStateFallback(Display* display,
                                                          bool paragraph) {
  // ...
  PressKey(display, paragraph ? "up" : "home",
           std::vector<std::string>{"control", "shift"});
  PressKey(display, "c", std::vector<std::string>{"control"});
  // ...
  std::string left = GetClipboard(display, window);
  // ...
```

## Practical Conclusion

If you want this file to support Wayland-only distros well, the realistic modernization split is:

- Rewrite input injection around `xdg-desktop-portal` `RemoteDesktop` + `libei`.
- Rewrite editor/focus introspection around AT-SPI.
- Treat window-manager-style features like app enumeration, arbitrary focusing, and global pointer position as best-effort desktop-specific integrations, not portable core features.
- Drop or redesign the clipboard-based fallback path.

If you want, I can next turn this into a function-by-function migration matrix for `src/linux.cpp` with suggested replacement API/tool for each symbol.

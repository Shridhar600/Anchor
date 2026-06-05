//! macOS-specific window tweaks for Anchor.
//!
//! At runtime, applies the macOS traffic-light button position on the main
//! window. The config-file `trafficLightPosition` is not honored reliably on
//! Tauri 2.x — it can reset on resize, focus change, fullscreen toggle, or
//! theme change — so we set it programmatically via the AppKit/cocoa API
//! after the window is created, and re-apply on window events.

use objc2::rc::Retained;
use objc2_app_kit::{NSView, NSWindow, NSWindowButton};
use tauri::WebviewWindow;

/// Single source of truth for macOS traffic-light button placement.
/// `(x, y)` in logical pixels from the window's top-left corner.
/// Centers the ~12px-tall lights in the 54px-tall topbar.
pub(crate) const TRAFFIC_LIGHT_INSET: (f64, f64) = (16.0, 21.0);

/// Re-apply the macOS traffic-light position on `window`.
///
/// The closure passed to `with_webview` runs on the main thread, which is
/// required for AppKit. Idempotent: safe to call on every resize/focus.
pub(crate) fn apply_traffic_light_position(window: &WebviewWindow) {
    let (x, y) = TRAFFIC_LIGHT_INSET;
    let _ = window.with_webview(move |webview| {
        // SAFETY: `webview.ns_window()` is a valid non-null `NSWindow*` kept
        // alive by the `WebviewWindow` borrow held by the caller for the
        // entire duration of this closure.
        let ns_window: &NSWindow = unsafe { &*(webview.ns_window() as *const NSWindow) };
        // SAFETY: see above.
        unsafe { inset_traffic_lights(ns_window, x, y) };
    });
}

/// Re-positions the three traffic-light buttons and the title-bar container
/// frame. Algorithm adapted from `tao` (the Tauri windowing crate), which
/// uses the same approach internally; replicated here because the public
/// Tauri API does not expose a runtime setter for this.
unsafe fn inset_traffic_lights(window: &NSWindow, x: f64, y: f64) {
    let close = window
        .standardWindowButton(NSWindowButton::CloseButton)
        .expect("close button should exist on a decorated window");
    let miniaturize = window
        .standardWindowButton(NSWindowButton::MiniaturizeButton)
        .expect("miniaturize button should exist on a decorated window");
    let zoom = window
        .standardWindowButton(NSWindowButton::ZoomButton)
        .expect("zoom button should exist on a decorated window");

    // The three buttons are `NSButton` (a subclass of `NSView`); we need
    // `NSView` methods (`frame`, `setFrameOrigin`, `superview`) on them.
    // SAFETY: `NSButton` IS-A `NSView` in AppKit, so the pointer cast is a
    // no-op. The retain count on the underlying object is unaffected.
    let close_view: &NSView = unsafe { &*(Retained::as_ptr(&close) as *const NSView) };
    let min_view: &NSView = unsafe { &*(Retained::as_ptr(&miniaturize) as *const NSView) };
    let zoom_view: &NSView = unsafe { &*(Retained::as_ptr(&zoom) as *const NSView) };

    // The title-bar container is the grandparent of the close button.
    // SAFETY: `superview` is unsafe; the returned view is owned by AppKit
    // and the unwraps match tao's own usage.
    let title_bar_container_view = unsafe { close_view.superview() }
        .and_then(|p| unsafe { p.superview() })
        .expect("title bar container view should be reachable");

    let close_rect = close_view.frame();
    let title_bar_frame_height = close_rect.size.height + y;
    let mut title_bar_rect = title_bar_container_view.frame();
    title_bar_rect.size.height = title_bar_frame_height;
    title_bar_rect.origin.y = window.frame().size.height - title_bar_frame_height;
    title_bar_container_view.setFrame(title_bar_rect);

    let space_between = min_view.frame().origin.x - close_rect.origin.x;
    let buttons = [(close_view, 0usize), (min_view, 1), (zoom_view, 2)];
    for (button, i) in buttons {
        let mut rect = button.frame();
        rect.origin.x = x + (i as f64 * space_between);
        button.setFrameOrigin(rect.origin);
    }
}

// Dark mode: three states — system (default, no stored preference), or an
// explicit light/dark override. Persisted in localStorage; the CSS handles
// system via `@media (prefers-color-scheme)` on its own, so this file's job
// is only to (a) apply an explicit override before first paint, avoiding a
// flash of the wrong theme, and (b) drive the footer toggle.
//
// Split from main.js because that script is `defer`red — it runs after the
// page has already painted, which is too late to prevent the flash. This
// file is loaded synchronously in <head>, before <body>, and must stay tiny.

(function () {
  var STORAGE_KEY = "theme";
  var root = document.documentElement;

  function stored() {
    try {
      var value = window.localStorage.getItem(STORAGE_KEY);
      return value === "light" || value === "dark" ? value : null;
    } catch (err) {
      // Private browsing / disabled storage: fall back to system, silently.
      return null;
    }
  }

  function apply(theme) {
    if (theme) {
      root.setAttribute("data-theme", theme);
    } else {
      root.removeAttribute("data-theme");
    }
  }

  // Runs synchronously, before <body> — this is the line that prevents the
  // flash. Everything else in this file can safely wait for DOMContentLoaded.
  apply(stored());

  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.querySelector("[data-theme-toggle]");
    if (!toggle) return;

    var label = toggle.querySelector("[data-theme-toggle-label]");
    var icon = toggle.querySelector(".theme-toggle-icon");
    var media = window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

    // What the toggle SHOWS reflects the current state (system/light/dark);
    // what it DOES on click is advance to the next one in that cycle.
    var ORDER = ["system", "light", "dark"];
    var COPY = {
      system: { icon: "🖥️", text: "Theme: System" },
      light: { icon: "☀️", text: "Theme: Light" },
      dark: { icon: "🌙", text: "Theme: Dark" },
    };

    function current() {
      var value = stored();
      return value || "system";
    }

    function render() {
      var state = current();
      var copy = COPY[state];
      toggle.setAttribute("data-theme-state", state);
      toggle.setAttribute(
        "aria-label",
        copy.text + ". Click to change the site's color theme."
      );
      if (icon) icon.textContent = copy.icon;
      if (label) {
        label.textContent = copy.text;
      } else {
        toggle.textContent = copy.icon + " " + copy.text;
      }
    }

    toggle.addEventListener("click", function () {
      var next = ORDER[(ORDER.indexOf(current()) + 1) % ORDER.length];
      try {
        if (next === "system") {
          window.localStorage.removeItem(STORAGE_KEY);
        } else {
          window.localStorage.setItem(STORAGE_KEY, next);
        }
      } catch (err) {
        // Storage unavailable: theme still applies for this load via apply()
        // below, it just won't persist across page views.
      }
      apply(next === "system" ? null : next);
      render();
    });

    // Another tab changing the theme, or (for "system") the OS theme itself
    // changing while this page is open.
    window.addEventListener("storage", function (event) {
      if (event.key === STORAGE_KEY) render();
    });
    if (media && media.addEventListener) {
      media.addEventListener("change", function () {
        if (current() === "system") render();
      });
    }

    render();
  });
})();

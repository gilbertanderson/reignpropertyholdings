// Mobile nav toggle
document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.querySelector(".nav-toggle");
  var panel = document.querySelector(".mobile-panel");
  if (toggle && panel) {
    toggle.addEventListener("click", function () {
      var isOpen = panel.classList.toggle("open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  // Contact page: pre-select property of interest from ?property= query param
  var propertySelect = document.querySelector("#property-of-interest");
  if (propertySelect) {
    var params = new URLSearchParams(window.location.search);
    var property = params.get("property");
    if (property) {
      for (var i = 0; i < propertySelect.options.length; i++) {
        if (propertySelect.options[i].value === property) {
          propertySelect.selectedIndex = i;
          break;
        }
      }
    }
  }

  // Contact page: visitors sent here from /apply when a listing has no live
  // TurboTenant application get a short explanation and a prefilled message.
  var applyNote = document.querySelector("#apply-note");
  if (applyNote) {
    var applyParams = new URLSearchParams(window.location.search);
    if (applyParams.get("apply")) {
      applyNote.hidden = false;
      var messageField = document.querySelector("#message");
      if (messageField && !messageField.value) {
        var wanted = applyParams.get("property");
        messageField.value = wanted
          ? "I'd like to apply for " + wanted + ". Please let me know the next steps."
          : "I'd like to apply for one of your rentals. Please let me know the next steps.";
      }
    }
  }

  // Contact form: submit via fetch to the Pages Function, show inline status
  var contactForm = document.querySelector("#contact-form");
  if (contactForm) {
    var statusEl = contactForm.querySelector("#form-status");
    var submitBtn = contactForm.querySelector("button[type=submit]");

    var showStatus = function (type, text) {
      if (!statusEl) return;
      statusEl.className = "form-status visible " + type;
      statusEl.textContent = text;
    };

    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (statusEl) {
        statusEl.className = "form-status";
        statusEl.textContent = "";
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
      }

      var formData = new FormData(contactForm);
      var payload = {};
      formData.forEach(function (value, key) { payload[key] = value; });

      fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, data: data }; });
        })
        .then(function (result) {
          if (result.ok && result.data.ok) {
            contactForm.reset();
            showStatus("success", "Thanks! Your message has been sent. We'll be in touch soon.");
          } else {
            showStatus("error", (result.data && result.data.error) || "Something went wrong. Please try again or call us directly.");
          }
        })
        .catch(function () {
          showStatus("error", "Something went wrong. Please try again or call us directly.");
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Send Message";
          }
        });
    });
  }

  // Property gallery: click a thumbnail to swap the main photo
  var galleries = document.querySelectorAll("[data-gallery]");
  galleries.forEach(function (gallery) {
    var main = gallery.querySelector(".gallery-main img");
    var thumbs = gallery.querySelectorAll(".gallery-thumbs button");
    thumbs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var fullSrc = btn.getAttribute("data-full");
        var alt = btn.getAttribute("data-alt");
        if (main && fullSrc) {
          main.setAttribute("src", fullSrc);
          main.setAttribute("alt", alt || "");
        }
        thumbs.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
      });
    });
  });

  // Furnished stays: fill in the next opening from the booking platforms'
  // iCal feeds, via /api/availability.
  //
  // Progressive enhancement on purpose. The line stays hidden unless the API
  // returns a real date, so an unset feed, a slow platform, or an outage all
  // render as "no availability line" rather than an empty or broken box. The
  // booking links above it work regardless.
  var stayBlocks = document.querySelectorAll("[data-stays]");
  stayBlocks.forEach(function (block) {
    var slug = block.getAttribute("data-stays");
    var line = block.querySelector("[data-stays-availability]");
    if (!slug || !line || !window.fetch) return;

    fetch("/api/availability?slug=" + encodeURIComponent(slug))
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !data.available || !data.availableFrom) return;

        // availableFrom is a plain YYYY-MM-DD. Parse and format it as UTC —
        // letting it go through local time shifts the date by a day for
        // anyone west of UTC, which is everyone reading this site.
        var from = new Date(data.availableFrom + "T00:00:00Z");
        if (isNaN(from.getTime())) return;

        var todayUtc = new Date();
        todayUtc = Date.UTC(
          todayUtc.getUTCFullYear(),
          todayUtc.getUTCMonth(),
          todayUtc.getUTCDate()
        );

        var nights = data.minNights || 30;
        if (from.getTime() <= todayUtc) {
          line.textContent =
            "Available now for stays of " + nights + " nights or more.";
        } else {
          line.textContent =
            "Next opening for a " + nights + "-night stay: " +
            from.toLocaleDateString("en-US", {
              month: "long", day: "numeric", year: "numeric", timeZone: "UTC"
            }) + ".";
        }
        line.hidden = false;
      })
      .catch(function () {
        /* Leave the line hidden. */
      });
  });
});

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

  // Property gallery: click a thumbnail to swap the main photo.
  //
  // The hero is a <picture>, so the <source> has to be updated too — a
  // matching source outranks the <img> src, and setting src alone would leave
  // the previous photo on screen in every browser that supports webp.
  var galleries = document.querySelectorAll("[data-gallery]");
  galleries.forEach(function (gallery) {
    var main = gallery.querySelector(".gallery-main img");
    var source = gallery.querySelector(".gallery-main [data-gallery-source]");
    var thumbs = gallery.querySelectorAll(".gallery-thumbs button");
    thumbs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var fullSrc = btn.getAttribute("data-full");
        var fullSrcset = btn.getAttribute("data-full-srcset");
        var alt = btn.getAttribute("data-alt");
        if (main && fullSrc) {
          if (source && fullSrcset) source.setAttribute("srcset", fullSrcset);
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
  //
  // Blocks carry data-stays="<slug>" and hold a [data-stays-availability]
  // element. Both the property cards and the detail-page stays panel use this,
  // so a page can hold two blocks for one home; requests are cached by slug so
  // that costs one fetch, not two.
  var stayBlocks = document.querySelectorAll("[data-stays]");
  var availabilityBySlug = {};

  var fetchAvailability = function (slug) {
    if (!availabilityBySlug[slug]) {
      availabilityBySlug[slug] = fetch(
        "/api/availability?slug=" + encodeURIComponent(slug)
      )
        .then(function (res) { return res.ok ? res.json() : null; })
        .catch(function () { return null; });
    }
    return availabilityBySlug[slug];
  };

  // Cards have room for a few words; the detail panel can carry a sentence.
  var availabilityText = function (data, from, todayUtc, compact) {
    var nights = data.minNights || 30;
    var openNow = from.getTime() <= todayUtc;
    var month = from.toLocaleDateString("en-US", {
      month: compact ? "short" : "long",
      day: "numeric",
      year: compact ? undefined : "numeric",
      timeZone: "UTC"
    });

    if (compact) {
      return openNow
        ? "Furnished stay available now"
        : "Furnished stay from " + month;
    }
    return openNow
      ? "Available now for stays of " + nights + " nights or more."
      : "Next opening for a " + nights + "-night stay: " + month + ".";
  };

  stayBlocks.forEach(function (block) {
    var slug = block.getAttribute("data-stays");
    var line = block.querySelector("[data-stays-availability]");
    if (!slug || !line || !window.fetch) return;

    fetchAvailability(slug).then(function (data) {
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

      line.textContent = availabilityText(
        data,
        from,
        todayUtc,
        line.hasAttribute("data-stays-compact")
      );
      line.hidden = false;
    });
  });
});

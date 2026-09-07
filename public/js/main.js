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

      // Offer a way back to the home they came from. `home` is supplied by the
      // /apply redirect, but treat it as untrusted input all the same: only a
      // same-origin path is allowed, so a crafted ?home=//evil.example or a
      // javascript: value can't turn this into an off-site link.
      var home = applyParams.get("home");
      var wantedHome = applyParams.get("property");
      if (home && home.charAt(0) === "/" && home.charAt(1) !== "/" && wantedHome) {
        var back = document.createElement("a");
        back.setAttribute("href", home);
        back.textContent = "Back to " + wantedHome;
        back.style.fontWeight = "700";
        applyNote.appendChild(document.createTextNode(" "));
        applyNote.appendChild(back);
      }

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

  // Property gallery: Redfin-style collage + room-labeled thumbs.
  //
  // The selected photo lives in .gallery-main (<picture>), so the <source>
  // has to be updated too — a matching source outranks the <img> src.
  var galleries = document.querySelectorAll("[data-gallery]");
  galleries.forEach(function (gallery) {
    var main = gallery.querySelector(".gallery-main img");
    var source = gallery.querySelector(".gallery-main [data-gallery-source]");
    var thumbs = gallery.querySelectorAll(".gallery-thumbs button");
    var collageTiles = gallery.querySelectorAll(
      ".gallery-collage [data-full]"
    );
    var rooms = gallery.querySelector("[data-gallery-rooms]");
    var seeAll = gallery.querySelector("[data-gallery-see-all]");

    function showPhoto(fullSrc, fullSrcset, alt) {
      if (!main || !fullSrc) return;
      gallery.classList.add("is-open");
      if (source && fullSrcset) source.setAttribute("srcset", fullSrcset);
      main.setAttribute("src", fullSrc);
      main.setAttribute("alt", alt || "");
    }

    function focusThumb(btn) {
      thumbs.forEach(function (b) { b.classList.remove("active"); });
      if (btn && btn.closest(".gallery-thumbs")) btn.classList.add("active");
    }

    function activateFromButton(btn) {
      showPhoto(
        btn.getAttribute("data-full"),
        btn.getAttribute("data-full-srcset"),
        btn.getAttribute("data-alt")
      );
      // Prefer the matching room thumb when a collage tile was clicked.
      var full = btn.getAttribute("data-full");
      var match = null;
      thumbs.forEach(function (t) {
        if (t.getAttribute("data-full") === full) match = t;
      });
      focusThumb(match || (btn.closest(".gallery-thumbs") ? btn : null));
      if (main) {
        main.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }

    thumbs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        activateFromButton(btn);
      });
    });

    collageTiles.forEach(function (btn) {
      btn.addEventListener("click", function () {
        activateFromButton(btn);
      });
    });

    if (seeAll && rooms) {
      seeAll.addEventListener("click", function () {
        rooms.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    }
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

  // js/calendar.js renders the month grid from the same endpoint. It is a
  // module, so it runs after this classic script and can reuse these promises
  // instead of fetching /api/availability a second time.
  window.__staysAvailability = availabilityBySlug;

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

  // Long-term lease status (e.g. 508 Avenue E "Leased" / "Available").
  // Sourced from /api/listings — checked-in TurboTenant flags + optional
  // Pages env override. Not a live TurboTenant vacancy feed.
  var leaseBlocks = document.querySelectorAll("[data-lease]");
  var listingsPromise = null;

  var fetchListings = function () {
    if (!listingsPromise) {
      listingsPromise = fetch("/api/listings")
        .then(function (res) { return res.ok ? res.json() : null; })
        .catch(function () { return null; });
    }
    return listingsPromise;
  };

  var leaseText = function (available, compact) {
    if (compact) return available ? "Available" : "Leased";
    return available ? "Available to lease." : "Currently leased.";
  };

  leaseBlocks.forEach(function (block) {
    var slug = block.getAttribute("data-lease");
    var line = block.matches("[data-lease-availability]")
      ? block
      : block.querySelector("[data-lease-availability]");
    if (!slug || !line || !window.fetch) return;

    fetchListings().then(function (data) {
      var entry = data && data.listings && data.listings[slug];
      if (!entry || typeof entry.available !== "boolean") return;
      line.textContent = leaseText(
        entry.available,
        line.hasAttribute("data-lease-compact")
      );
      line.hidden = false;
    });
  });
});

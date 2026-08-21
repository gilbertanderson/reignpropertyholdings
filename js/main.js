// Mobile nav toggle
document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.querySelector(".nav-toggle");
  var panel = document.querySelector(".mobile-panel");
  if (toggle && panel) {
    toggle.addEventListener("click", function () {
      panel.classList.toggle("open");
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
});

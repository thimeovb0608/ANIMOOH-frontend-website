// Mobile navigation — toggles the dropdown menu open/closed.
// One shared file used by every page, so the logic lives in a single place.
(function () {
  var nav = document.querySelector(".nav-brand");
  if (!nav) return;
  var toggle = nav.querySelector(".nav-toggle");
  if (!toggle) return;

  // Tap the hamburger → open/close the menu.
  toggle.addEventListener("click", function (e) {
    e.stopPropagation();
    var isOpen = nav.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  // Tap any link → close the menu (so it doesn't stay open after navigating).
  nav.querySelectorAll("ul a").forEach(function (link) {
    link.addEventListener("click", function () {
      nav.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  // Tap anywhere outside the nav → close the menu.
  document.addEventListener("click", function (e) {
    if (!nav.contains(e.target)) {
      nav.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
})();

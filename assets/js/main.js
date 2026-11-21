const menuToggle = document.querySelector(".menu-toggle");
const mainNavigation = document.querySelector("#main-navigation");

const activePage = document.body.dataset.page;
if (activePage) {
  document.querySelectorAll(".nav-link[data-page]").forEach((link) => {
    if (link.dataset.page === activePage) {
      link.setAttribute("aria-current", "page");
    }
  });
}

if (menuToggle && mainNavigation) {
  const isMobileNavigation = () => window.matchMedia("(max-width: 820px)").matches;
  const closeMenu = () => {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Abrir menu");
    mainNavigation.hidden = true;
  };

  const syncNavigation = () => {
    if (isMobileNavigation()) {
      closeMenu();
    } else {
      mainNavigation.hidden = false;
    }
  };

  syncNavigation();

  menuToggle.addEventListener("click", () => {
    const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isExpanded));
    menuToggle.setAttribute("aria-label", isExpanded ? "Abrir menu" : "Fechar menu");
    mainNavigation.hidden = isExpanded;
  });

  mainNavigation.addEventListener("click", (event) => {
    if (isMobileNavigation() && event.target.closest("a")) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
      closeMenu();
      menuToggle.focus();
    }
  });

  window.addEventListener("resize", syncNavigation);
}
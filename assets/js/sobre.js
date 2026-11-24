const initializeAboutPage = () => {
  const revealElements = [...document.querySelectorAll(".reveal")];
  const heroContent = document.querySelector(".sobre-hero .reveal");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (heroContent) heroContent.classList.add("is-visible");

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -30px 0px" });

    revealElements.forEach((element) => {
      if (element === heroContent) return;
      if (element.getBoundingClientRect().top < window.innerHeight * 0.95) {
        element.classList.add("is-visible");
        return;
      }
      revealObserver.observe(element);
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    const targetId = link.getAttribute("href").slice(1);
    const target = document.getElementById(targetId);
    if (!target) return;

    link.addEventListener("click", (event) => {
      event.preventDefault();
      target.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start"
      });
      window.history.replaceState(null, "", `#${targetId}`);
    });
  });

  const whatsappPhone = "553196809579";
  const openWhatsApp = (message) => {
    const url = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  document.querySelectorAll("[data-whatsapp]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openWhatsApp(trigger.dataset.whatsapp || "Olá! Gostaria de falar com a Bby Mila Nails.");
    });
  });

  const scheduleButton = document.querySelector(".site-header [data-open-scheduling]");
  if (scheduleButton) {
    scheduleButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      openWhatsApp("Olá! Gostaria de agendar um horário com a Bby Mila Nails.");

      const menuToggle = document.querySelector(".menu-toggle");
      const mainNavigation = document.querySelector("#main-navigation");
      if (menuToggle && mainNavigation && window.matchMedia("(max-width: 680px)").matches) {
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Abrir menu");
        mainNavigation.hidden = true;
      }
    }, true);
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeAboutPage, { once: true });
} else {
  initializeAboutPage();
}

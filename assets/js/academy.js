const academyWhatsApp = "https://wa.me/553196809579";

document.querySelectorAll("[data-course]").forEach((link) => {
  const course = link.dataset.course;
  const message = `Olá! Gostaria de receber informações sobre a formação "${course}" da Bby Mila Academy.`;
  link.href = `${academyWhatsApp}?text=${encodeURIComponent(message)}`;
});

document.querySelectorAll(".academy-faq-item button").forEach((button) => {
  button.addEventListener("click", () => {
    const shouldExpand = button.getAttribute("aria-expanded") !== "true";

    document.querySelectorAll(".academy-faq-item button").forEach((item) => {
      item.setAttribute("aria-expanded", "false");
      document.getElementById(item.getAttribute("aria-controls")).hidden = true;
    });

    button.setAttribute("aria-expanded", String(shouldExpand));
    document.getElementById(button.getAttribute("aria-controls")).hidden = !shouldExpand;
  });
});

const academyRevealItems = [...document.querySelectorAll(".academy-page [data-reveal]")];
const academyReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (academyReduceMotion || !("IntersectionObserver" in window)) {
  academyRevealItems.forEach((item) => item.classList.add("is-visible"));
} else {
  academyRevealItems.forEach((item) => {
    if (item.getBoundingClientRect().top < window.innerHeight * 0.95) {
      item.classList.add("is-visible");
    }
  });

  document.body.classList.add("academy-reveal-ready");
  const academyObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });

  academyRevealItems.forEach((item) => {
    if (!item.classList.contains("is-visible")) academyObserver.observe(item);
  });
}

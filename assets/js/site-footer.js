if (!document.querySelector(".global-site-footer")) {
  const footer = document.createElement("footer");
  footer.className = "global-site-footer";
  footer.setAttribute("aria-label", "Rodapé do site");
  footer.innerHTML = `
    <div class="global-footer-main">
      <a href="index.html" class="global-footer-brand" aria-label="Bby Mila Nails - início">
        <span>Bby Mila</span>
        <small>NAILS</small>
      </a>
      <a
        class="global-footer-detail"
        href="https://www.google.com/maps/search/?api=1&query=Avenida+Augusto+de+Lima,+1376,+Barro+Preto,+Belo+Horizonte+-+MG"
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="12" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        <span>Avenida Augusto de Lima, 1376<br>Barro Preto, Belo Horizonte – MG</span>
      </a>
      <a class="global-footer-detail" href="https://www.instagram.com/bbymilanails/" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>
        </svg>
        <span>@bbymilanails</span>
      </a>
      <a class="global-footer-detail" href="https://wa.me/553196809579" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 11.6a8 8 0 0 1-11.8 7L4 20l1.4-4.1A8 8 0 1 1 20 11.6Z" stroke="currentColor" stroke-width="1.5"/>
          <path d="M9 8.5c.4 2.4 2.1 4.1 4.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>Fale conosco</span>
      </a>
      <p class="global-footer-tagline">Beleza como<br>forma de expressão.</p>
    </div>
    <div class="global-footer-bottom">
      <span>© 2026 BBY MILA NAILS — TODOS OS DIREITOS RESERVADOS.</span>
    </div>
  `;
  document.body.append(footer);
}

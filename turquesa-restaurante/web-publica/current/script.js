const header = document.querySelector("[data-header]");
const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const form = document.querySelector("[data-reservation-form]");

function updateHeader() {
  header.classList.toggle("is-scrolled", window.scrollY > 18);
}

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

toggle.addEventListener("click", () => {
  const open = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", String(!open));
  header.classList.toggle("is-open", !open);
});

nav.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    toggle.setAttribute("aria-expanded", "false");
    header.classList.remove("is-open");
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const nombre = String(data.get("nombre") || "").trim();
  const celular = String(data.get("celular") || "").trim();
  const fecha = String(data.get("fecha") || "").trim();
  const personas = String(data.get("personas") || "").trim();
  const mensaje = String(data.get("mensaje") || "").trim();
  const status = form.querySelector(".form-status");

  if (nombre && celular && fecha && personas) {
    const lines = [
      "Hola Turquesa Restaurante by RDSS Santana Group, quiero reservar una mesa.",
      `Nombre: ${nombre}`,
      `Celular: ${celular}`,
      `Fecha: ${fecha}`,
      `Personas: ${personas}`,
    ];

    if (mensaje) {
      lines.push(`Nota: ${mensaje}`);
    }

    const url = `https://wa.me/18297550107?text=${encodeURIComponent(lines.join("\n"))}`;
    status.textContent = `Solicitud lista para ${nombre}. Abriendo WhatsApp.`;
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  status.textContent = nombre && fecha
    ? "Completa celular y personas para enviar la solicitud."
    : "Completa tus datos para preparar la solicitud.";
});

import type { Metadata } from "next";
import TurquesaReservationForm from "./TurquesaReservationForm";
import styles from "./TurquesaPublicSite.module.css";

export const metadata: Metadata = {
  title: "Turquesa Restaurante by RDSS Santana Group | Bayahibe",
  description:
    "Cocina de playa frente al Caribe en Cadaques Caribe, Bayahibe: mariscos frescos, cocteleria tropical y reservas junto al mar.",
};

const menuItems = [
  ["Del mar", "Pescado local a la brasa", "Citrico, hierbas frescas y vegetales de temporada."],
  ["Entrada", "Ceviche Turquesa", "Leche de coco, mango, cilantro y crujiente ligero."],
  ["Especial", "Langosta segun disponibilidad", "Mantequilla de ajo, limon y guarnicion de la casa."],
  ["Bar", "Cocteles Turquesa", "Frutas tropicales, destilados premium y hielo cristalino."],
];

export default function TurquesaPublicSite() {
  return (
    <main className={styles.site}>
      <header className={styles.header}>
        <a className={styles.brand} href="#inicio" aria-label="Turquesa Restaurante">
          <img src="/brand/turquesa-logo-transparent.png" alt="" />
          <span>by RDSS Santana Group</span>
        </a>
        <nav className={styles.nav} aria-label="Principal">
          <a href="#experiencia">Experiencia</a>
          <a href="#menu">Menu</a>
          <a href="#galeria">Galeria</a>
          <a href="#ubicacion">Ubicacion</a>
          <a className={styles.navCta} href="#reservas">Reservar mesa</a>
        </nav>
      </header>

      <section id="inicio" className={styles.hero}>
        <div className={styles.heroMedia} />
        <div className={styles.heroShade} />
        <div className={styles.heroContent}>
          <h1>Turquesa Restaurante</h1>
          <p className={styles.byline}>by RDSS Santana Group</p>
          <p>
            Cocina de playa frente al Caribe en Cadaques Caribe, Bayahibe:
            producto fresco, cocteleria tropical y una terraza pensada para
            quedarse hasta el atardecer.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href="#reservas">Reservar mesa</a>
            <a className={styles.ghostButton} href="#menu">Ver menu</a>
          </div>
        </div>
      </section>

      <section id="experiencia" className={`${styles.section} ${styles.experience}`}>
        <div>
          <p className={styles.label}>Cadaques Caribe, Bayahibe</p>
          <h2>Una experiencia frente al mar, servida con calma.</h2>
          <p>
            Turquesa combina la frescura del Caribe con una cocina de costa
            cuidada: pescados, mariscos, platos para compartir y cocteles
            preparados para acompanar la vista.
          </p>
        </div>
        <div className={styles.points}>
          <article>
            <span>01</span>
            <h3>Terraza de playa</h3>
            <p>Mesas abiertas al paisaje, brisa marina y luz natural durante todo el dia.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Cocina fresca</h3>
            <p>Sabores caribenos, tecnicas limpias y producto local cuando esta disponible.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Atardecer Turquesa</h3>
            <p>Un cierre de dia con cocteleria, musica suave y atmosfera de resort.</p>
          </article>
        </div>
      </section>

      <section id="menu" className={`${styles.section} ${styles.menuSection}`}>
        <div className={styles.menuIntro}>
          <p className={styles.label}>Sabores de costa</p>
          <h2>Menu pensado para el mar.</h2>
          <p>
            Una seleccion breve, fresca y elegante: platos del dia, mariscos,
            entradas frias, cocteleria y postres tropicales.
          </p>
        </div>
        <div className={styles.menuLayout}>
          <div className={styles.menuList}>
            {menuItems.map(([category, title, text]) => (
              <article key={title}>
                <p>{category}</p>
                <h3>{title}</h3>
                <span>{text}</span>
              </article>
            ))}
          </div>
          <div className={styles.menuMedia}>
            <img src="/brand/turquesa-signature-seafood.jpg" alt="Plato de pescado fresco servido junto al mar" />
            <img src="/brand/turquesa-signature-cocktail.jpg" alt="Coctel tropical con tonos turquesa" />
          </div>
        </div>
      </section>

      <section id="galeria" className={`${styles.section} ${styles.gallery}`}>
        <div>
          <p className={styles.label}>Ambiente</p>
          <h2>La mesa, la playa y la luz de Bayahibe.</h2>
        </div>
        <div className={styles.galleryGrid}>
          <img src="/brand/turquesa-restaurant-logo.png" alt="Logo y ambiente de Turquesa Restaurante" />
          <img src="/brand/turquesa-beach-vertical.jpg" alt="Vista del mar frente a Turquesa Restaurante" />
          <article>
            <h3>Para almuerzos largos, cenas tranquilas y celebraciones junto al mar.</h3>
            <p>
              El espacio esta disenado para sentirse natural: madera, fibras,
              piedra clara y el azul del Caribe como protagonista.
            </p>
          </article>
        </div>
      </section>

      <section id="ubicacion" className={`${styles.section} ${styles.location}`}>
        <div className={styles.locationCard}>
          <p className={styles.label}>Ubicacion</p>
          <h2>Cadaques Caribe, Bayahibe</h2>
          <p>
            Estamos en la zona de Bayahibe, dentro del complejo Cadaques Caribe,
            un entorno de playa ideal para disfrutar una mesa frente al mar.
          </p>
          <div className={styles.contactLinks}>
            <a href="tel:+18297550107">829-755-0107</a>
            <a href="mailto:turquesarestaurantbayahibe@gmail.com">turquesarestaurantbayahibe@gmail.com</a>
          </div>
          <a
            className={styles.textLink}
            href="https://www.google.com/maps/search/?api=1&query=Cadaques%20Caribe%20Bayahibe"
            target="_blank"
            rel="noreferrer"
          >
            Abrir en Google Maps
          </a>
        </div>
        <div className={styles.locationImage} />
      </section>

      <section id="reservas" className={`${styles.section} ${styles.reservation}`}>
        <div>
          <p className={styles.label}>Reservas</p>
          <h2>Planifica tu visita.</h2>
          <p>
            Solicita disponibilidad desde aqui. El equipo de Turquesa recibira
            la reserva en el sistema y confirmara la mesa antes de dejarla firme.
          </p>
        </div>
        <div className={styles.reserveCard}>
          <strong>Turquesa Restaurante</strong>
          <TurquesaReservationForm />
        </div>
      </section>
    </main>
  );
}

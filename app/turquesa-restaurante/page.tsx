import type { Metadata } from "next";
import TurquesaRestaurantOS from "@/turquesa-restaurante/sistema-restaurante/TurquesaRestaurantOS";

export const metadata: Metadata = {
  title: "Turquesa Restaurante OS | Gestion restaurante",
  description: "Centro operativo para POS, mesas, comandas, cocina, reservas, inventario y cierre diario de Turquesa Restaurante.",
};

export default function TurquesaRestaurantePage() {
  return <TurquesaRestaurantOS />;
}

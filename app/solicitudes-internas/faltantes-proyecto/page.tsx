import { redirect } from "next/navigation";

export default function FaltantesProyectoPage() {
  redirect("/helpdesk?type=faltante_proyecto");
}

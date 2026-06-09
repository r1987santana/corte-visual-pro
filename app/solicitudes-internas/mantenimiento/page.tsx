import { redirect } from "next/navigation";

export default function MantenimientoSolicitudesPage() {
  redirect("/helpdesk?type=mantenimiento");
}

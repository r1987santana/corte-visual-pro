import { redirect } from "next/navigation";

export default function RequisicionAlmacenPage() {
  redirect("/helpdesk?type=requisicion_almacen");
}

import { redirect } from "next/navigation";

export default function RequisicionCompraPage() {
  redirect("/helpdesk?type=compra_requerida");
}

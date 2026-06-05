import Link from "next/link";

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-[#020817] px-6 py-10 text-slate-100">
      <section className="mx-auto max-w-4xl">
        <Link href="/login" className="text-sm font-bold text-cyan-300 hover:text-cyan-100">Volver al acceso</Link>
        <h1 className="mt-8 text-4xl font-black">Solicitud de eliminación de cuenta</h1>
        <p className="mt-3 text-slate-400">Última actualización: 5 de junio de 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-300">
          <p>
            Si tienes una cuenta en RD Wood System Pro, puedes solicitar la desactivación o eliminación de tu
            cuenta y la revisión de los datos asociados.
          </p>

          <Section title="Cómo solicitarlo">
            Envía una solicitud al administrador responsable de la empresa operadora indicando tu nombre,
            correo de acceso, área o rol, y el tipo de solicitud: eliminación de cuenta, desactivación,
            corrección de datos o copia de información.
          </Section>

          <Section title="Validación">
            Para proteger información empresarial, laboral y financiera, la empresa podrá validar identidad,
            relación laboral/comercial y permisos antes de eliminar datos.
          </Section>

          <Section title="Datos que pueden conservarse">
            Algunos registros pueden conservarse cuando sean necesarios para auditoría, contratos, pagos,
            nómina, cumplimiento legal, seguridad, trazabilidad de producción o defensa de reclamaciones.
          </Section>

          <Section title="Tiempo de respuesta">
            La empresa revisará la solicitud en un plazo razonable según la complejidad, obligaciones legales
            y políticas internas.
          </Section>
        </div>
      </section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-800 pt-5">
      <h2 className="text-xl font-black text-white">{title}</h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}

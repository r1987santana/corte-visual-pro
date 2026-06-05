import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#020817] px-6 py-10 text-slate-100">
      <section className="mx-auto max-w-4xl">
        <Link href="/login" className="text-sm font-bold text-cyan-300 hover:text-cyan-100">Volver al acceso</Link>
        <h1 className="mt-8 text-4xl font-black">Términos de uso</h1>
        <p className="mt-3 text-slate-400">Última actualización: 5 de junio de 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-300">
          <Section title="Uso autorizado">
            RD Wood System Pro es una herramienta empresarial privada. Solo usuarios autorizados por la
            empresa pueden acceder, consultar, modificar o exportar información.
          </Section>

          <Section title="Responsabilidad del usuario">
            Cada usuario debe proteger sus credenciales, usar el sistema únicamente para fines operativos
            legítimos y no compartir accesos, datos de clientes, datos laborales ni información financiera con
            personas no autorizadas.
          </Section>

          <Section title="Datos y auditoría">
            Las acciones dentro del sistema pueden registrarse para trazabilidad, seguridad, cumplimiento y
            soporte. El uso del sistema implica aceptación de estos controles internos.
          </Section>

          <Section title="Disponibilidad">
            El sistema puede requerir mantenimiento, actualizaciones o interrupciones técnicas. La empresa
            operadora podrá ajustar módulos, permisos y funcionalidades según sus necesidades.
          </Section>

          <Section title="Pagos y operaciones comerciales">
            Las cotizaciones, contratos, pagos y recibos generados por el sistema deben ser validados por los
            responsables administrativos antes de ser considerados definitivos.
          </Section>

          <Section title="Soporte">
            Para soporte, acceso o corrección de información, contacte al administrador interno responsable
            del sistema.
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

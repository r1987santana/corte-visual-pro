import Link from "next/link";

const updatedAt = "5 de junio de 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#020817] px-6 py-10 text-slate-100">
      <section className="mx-auto max-w-4xl">
        <Link href="/login" className="text-sm font-bold text-cyan-300 hover:text-cyan-100">Volver al acceso</Link>
        <h1 className="mt-8 text-4xl font-black">Política de privacidad</h1>
        <p className="mt-3 text-slate-400">Última actualización: {updatedAt}</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-300">
          <p>
            RD Wood System Pro es una plataforma empresarial para administrar ventas, clientes, inventario,
            producción, logística, RRHH, asistencia, nómina, reportes y portales operativos. Esta política
            explica qué datos se tratan y para qué se usan.
          </p>

          <Section title="Datos que puede procesar el sistema">
            Datos de usuarios y empleados, nombres, correos, teléfonos, roles, permisos, asistencia, recibos
            de nómina, documentos laborales, fotografías, registros faciales operativos, clientes, proyectos,
            cotizaciones, contratos, pagos, inventario, órdenes de compra, evidencias de instalación,
            ubicación operativa cuando el usuario la solicita, notificaciones push y registros de auditoría.
          </Section>

          <Section title="Finalidad del tratamiento">
            Operación interna del negocio, control de acceso, trazabilidad, auditoría, cumplimiento laboral,
            ejecución de proyectos, servicio al cliente, logística, seguridad, reportes administrativos y
            mejora de los procesos productivos.
          </Section>

          <Section title="Cámara, ubicación y notificaciones">
            La cámara se usa para escaneo QR, evidencias fotográficas y módulos de asistencia facial. La
            ubicación se usa solo en flujos operativos como transporte, instalación o entrega cuando el
            usuario activa esa función. Las notificaciones push se usan para avisos internos y pueden
            desactivarse desde el dispositivo.
          </Section>

          <Section title="Compartición de datos">
            Los datos no se venden. Pueden alojarse o procesarse mediante proveedores técnicos necesarios
            para operar el sistema, como hosting, base de datos, almacenamiento, autenticación, servicios de
            IA o infraestructura de notificaciones, bajo fines operativos.
          </Section>

          <Section title="Seguridad">
            El sistema utiliza control de sesión, roles, permisos, auditoría, conexión cifrada HTTPS en
            producción y restricciones de acceso por módulo. Las cuentas deben protegerse con credenciales
            asignadas por la empresa.
          </Section>

          <Section title="Retención y eliminación">
            Los datos se conservan mientras sean necesarios para la operación, obligaciones legales,
            auditoría o soporte. Los usuarios pueden solicitar revisión o eliminación de datos siguiendo el
            proceso publicado en la página de eliminación de cuenta.
          </Section>

          <Section title="Contacto de privacidad">
            Para consultas de privacidad, acceso, corrección o eliminación de datos, contacte al administrador
            responsable de RD Wood System Pro o use el canal publicado por la empresa operadora del sistema.
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

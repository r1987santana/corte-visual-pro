export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {children}
    </div>
  );
}
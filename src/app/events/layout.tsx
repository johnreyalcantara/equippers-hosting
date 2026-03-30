import Navbar from "@/components/Navbar";

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </>
  );
}

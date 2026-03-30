import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex gap-4 mb-6 border-b border-gray-200 pb-3">
          <Link
            href="/admin"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/events"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Events
          </Link>
          <Link
            href="/admin/users"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Users
          </Link>
        </div>
        {children}
      </main>
    </>
  );
}

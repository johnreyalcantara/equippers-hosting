"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

export default function AdminUsersPage() {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadUsers() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setProfiles(data);
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    // Use Supabase auth admin via edge function or sign up
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Update the profile role (trigger should have created it)
      await supabase
        .from("profiles")
        .update({ role, full_name: fullName })
        .eq("id", data.user.id);
    }

    setSuccess(`User ${email} created successfully`);
    setEmail("");
    setPassword("");
    setFullName("");
    setRole("user");
    setLoading(false);
    loadUsers();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Manage Users</h1>

      {/* Create user form */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <h2 className="font-semibold mb-3">Create User</h2>
        <form onSubmit={handleCreateUser} className="space-y-3">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full Name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 chars)"
            required
            minLength={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "user")}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">{success}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating..." : "Create User"}
          </button>
        </form>
      </div>

      {/* User list */}
      <div className="space-y-2">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="bg-white rounded-xl border px-4 py-3 flex items-center justify-between"
          >
            <div>
              <p className="font-medium text-sm">
                {profile.full_name || profile.email}
              </p>
              <p className="text-xs text-gray-400">{profile.email}</p>
            </div>
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${
                profile.role === "admin"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {profile.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

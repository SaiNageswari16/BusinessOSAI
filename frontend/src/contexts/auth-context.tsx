import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { mockUsers, AppUser } from "@/data/mockRbacData";

interface AuthCtx {
  user: AppUser | null;
  isAuthed: boolean;
  login: (email: string) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

const FALLBACK_USER = mockUsers[0]; // Alexandra Chen (Super Admin)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("bos-auth");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const login = (email: string) => {
    // Look up user by email, or fallback to first mock user
    const matchedUser = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    const u = matchedUser || { ...FALLBACK_USER, email: email };
    
    setUser(u);
    localStorage.setItem("bos-auth", JSON.stringify(u));
  };
  const logout = () => {
    setUser(null);
    localStorage.removeItem("bos-auth");
  };

  return (
    <Ctx.Provider value={{ user, isAuthed: !!user, login, logout }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}

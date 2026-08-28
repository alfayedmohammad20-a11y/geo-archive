import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { GlobeHemisphereWest, SignIn, SignOut, User } from "@phosphor-icons/react";

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header
      data-testid="site-header"
      className="sticky top-0 z-40 bg-[#F4F4F5]/85 backdrop-blur-xl border-b border-black/10"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
        <Link
          to="/"
          data-testid="logo-link"
          className="flex items-center gap-2 group"
        >
          <GlobeHemisphereWest size={28} weight="duotone" color="#002FA7" />
          <span className="font-display text-xl tracking-tighter">
            GEO<span className="text-[#002FA7]">/</span>ARCHIVE
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            to="/"
            data-testid="nav-archive"
            className="hidden sm:inline-block px-4 py-2 font-mono text-xs uppercase tracking-widest hover:text-[#002FA7]"
          >
            Archive
          </Link>
          {user ? (
            <>
              <Link
                to="/admin"
                data-testid="nav-admin"
                className="px-4 py-2 font-mono text-xs uppercase tracking-widest hover:text-[#002FA7] flex items-center gap-1"
              >
                <User size={14} weight="bold" /> Admin
              </Link>
              <button
                data-testid="logout-btn"
                onClick={async () => {
                  await logout();
                  navigate("/");
                }}
                className="btn-outline flex items-center gap-2 text-sm"
              >
                <SignOut size={16} weight="bold" /> Logout
              </button>
            </>
          ) : (
            <Link
              to="/admin/login"
              data-testid="nav-login"
              className="btn-outline flex items-center gap-2 text-sm"
            >
              <SignIn size={16} weight="bold" /> Admin
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

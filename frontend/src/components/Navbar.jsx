import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PenLine, Bookmark, LogOut, User, LayoutDashboard, ChevronDown } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { getMediaUrl } from "../lib/media";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
        <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
      <span className="text-lg font-semibold tracking-tight text-white">Nexora</span>
    </Link>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate("/");
  };

  const itemCls =
    "flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full p-0.5 transition-colors hover:bg-white/[0.06]"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-violet-500/30 to-indigo-600/30 text-xs font-semibold text-violet-200">
          {user?.avatar ? (
            <img src={getMediaUrl(user.avatar)} alt={user.username} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            (user?.username || "?").slice(0, 2).toUpperCase()
          )}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-fade-in absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113] p-1.5 shadow-2xl shadow-black/50"
        >
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="truncate text-sm font-medium text-white">
              {user?.first_name || user?.last_name
                ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                : user?.username}
            </p>
            <p className="truncate text-xs text-zinc-500">@{user?.username}</p>
          </div>
          <div className="pt-1.5">
            <Link to="/dashboard" role="menuitem" onClick={() => setOpen(false)} className={itemCls}>
              <LayoutDashboard className="h-4 w-4 text-zinc-500" />
              Dashboard
            </Link>
            <Link to="/profile" role="menuitem" onClick={() => setOpen(false)} className={itemCls}>
              <User className="h-4 w-4 text-zinc-500" />
              Profile
            </Link>
            <Link to="/reading-list" role="menuitem" onClick={() => setOpen(false)} className={itemCls}>
              <Bookmark className="h-4 w-4 text-zinc-500" />
              Reading List
            </Link>
          </div>
          <div className="border-t border-white/[0.06] pt-1.5">
            <button role="menuitem" onClick={handleLogout} className={`${itemCls} text-zinc-400`}>
              <LogOut className="h-4 w-4 text-zinc-500" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    setMobileOpen(false);
    logout();
    navigate("/");
  };

  const navLinkCls = "rounded-full px-4 py-2 text-sm font-medium transition-colors";
  const navLinkActive = "text-white hover:bg-white/[0.06]";
  const navLinkIdle = "text-zinc-400 hover:bg-white/[0.06] hover:text-white";

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#09090B]/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Logo />

        {/* Desktop Nav */}
        <div className="hidden items-center gap-1 md:flex">
          <Link to="/" className={`${navLinkCls} ${navLinkActive}`}>
            Home
          </Link>
          <Link to="/explore" className={`${navLinkCls} ${navLinkIdle}`}>
            Explore
          </Link>
          {isAuthenticated && (
            <Link to="/create" className={`${navLinkCls} ${navLinkIdle}`}>
              Write
            </Link>
          )}
        </div>

        {/* Right Side */}
        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <>
              <Link
                to="/reading-list"
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                title="Reading List"
                aria-label="Reading List"
              >
                <Bookmark className="h-[18px] w-[18px]" />
              </Link>
              <UserMenu />
            </>
          ) : (
            <>
              <Link to="/login" className="rounded-full px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:text-white">
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[#09090B] transition-all hover:bg-zinc-200 active:scale-[0.98]"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white md:hidden"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="animate-fade-in border-t border-white/[0.06] bg-[#09090B]/95 backdrop-blur-xl md:hidden">
          <div className="space-y-1 px-4 py-4">
            <Link to="/" onClick={() => setMobileOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-medium text-white hover:bg-white/[0.06]">
              Home
            </Link>
            <Link to="/explore" onClick={() => setMobileOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-medium text-zinc-400 hover:bg-white/[0.06] hover:text-white">
              Explore
            </Link>
            {isAuthenticated ? (
              <>
                <Link to="/create" onClick={() => setMobileOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-medium text-zinc-400 hover:bg-white/[0.06] hover:text-white">
                  Write
                </Link>
                <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-medium text-zinc-400 hover:bg-white/[0.06] hover:text-white">
                  Dashboard
                </Link>
                <Link to="/reading-list" onClick={() => setMobileOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-medium text-zinc-400 hover:bg-white/[0.06] hover:text-white">
                  Reading List
                </Link>
                <Link to="/profile" onClick={() => setMobileOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-medium text-zinc-400 hover:bg-white/[0.06] hover:text-white">
                  Profile
                </Link>
                <button onClick={handleLogout} className="block w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-zinc-400 hover:bg-white/[0.06] hover:text-white">
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-medium text-zinc-400 hover:bg-white/[0.06] hover:text-white">
                  Login
                </Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="block rounded-xl bg-white px-4 py-3 text-center text-sm font-medium text-[#09090B]">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

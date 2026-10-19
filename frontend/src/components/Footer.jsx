import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#0A0A0C]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="text-lg font-semibold tracking-tight text-white">Nexora</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-500">
              A modern publishing platform where writers, researchers, and technologists share in-depth insights on AI, data science, and the future of technology.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-sm font-semibold text-white">Platform</h3>
            <ul className="mt-4 space-y-2.5">
              <li><Link to="/" className="text-sm text-zinc-500 transition-colors hover:text-white">Home</Link></li>
              <li><Link to="/explore" className="text-sm text-zinc-500 transition-colors hover:text-white">Explore</Link></li>
              <li><Link to="/explore" className="text-sm text-zinc-500 transition-colors hover:text-white">Categories</Link></li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-sm font-semibold text-white">Categories</h3>
            <ul className="mt-4 space-y-2.5">
              <li><Link to="/explore" className="text-sm text-zinc-500 transition-colors hover:text-white">Generative AI</Link></li>
              <li><Link to="/explore" className="text-sm text-zinc-500 transition-colors hover:text-white">Machine Learning</Link></li>
              <li><Link to="/explore" className="text-sm text-zinc-500 transition-colors hover:text-white">Deep Learning</Link></li>
              <li><Link to="/explore" className="text-sm text-zinc-500 transition-colors hover:text-white">Python</Link></li>
              <li><Link to="/explore" className="text-sm text-zinc-500 transition-colors hover:text-white">Data Science</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/[0.06] pt-6">
          <p className="text-center text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} Nexora. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

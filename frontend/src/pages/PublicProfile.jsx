import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getPublicProfile } from "../services/users";
import Avatar from "../components/Avatar";
import ArticleCard from "../components/ArticleCard";
import Seo from "../components/Seo";
import { profileMeta, privateMeta } from "../lib/seo";

export default function PublicProfile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    setProfile(null);

    getPublicProfile(username)
      .then(setProfile)
      .catch((err) => setError(err.message || "Author not found."))
      .finally(() => setLoading(false));
  }, [username]);

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <Seo meta={privateMeta("Loading")} />
        <div className="flex flex-col items-center">
          <div className="h-24 w-24 rounded-full bg-white/[0.06] animate-pulse" />
          <div className="mt-5 h-7 w-40 rounded bg-white/[0.06] animate-pulse" />
          <div className="mt-3 h-4 w-24 rounded bg-white/[0.06] animate-pulse" />
          <div className="mt-3 h-4 w-64 rounded bg-white/[0.06] animate-pulse" />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 rounded-2xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error / not found
  if (error || !profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Seo meta={privateMeta("Author not found")} />
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <p className="text-lg font-medium text-zinc-300">Author not found</p>
          <p className="mt-2 text-sm text-zinc-500">
            This profile doesn't exist or the username is incorrect.
          </p>
          <Link
            to="/explore"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-medium text-[#09090B] transition-all hover:bg-zinc-200"
          >
            Back to Explore
          </Link>
        </div>
      </div>
    );
  }

  const displayName =
    profile.first_name || profile.last_name
      ? `${profile.first_name} ${profile.last_name}`.trim()
      : profile.username;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <Seo meta={profileMeta(profile)} />
      {/* Profile Header */}
      <header className="mb-12 flex flex-col items-center text-center">
        <Avatar user={profile} size="xl" />
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {displayName}
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">@{profile.username}</p>
        {profile.bio && (
          <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-400">
            {profile.bio}
          </p>
        )}
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-2">
          <span className="text-xl font-bold text-white">{profile.article_count}</span>
          <span className="text-sm text-zinc-500">
            {profile.article_count === 1 ? "Story" : "Stories"}
          </span>
        </div>
      </header>

      {/* Published Stories */}
      <h2 className="mb-6 text-xl font-semibold tracking-tight text-white">
        Published Stories
      </h2>

      {profile.articles.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <p className="text-lg font-medium text-zinc-300">No stories published yet.</p>
          <p className="mt-2 text-sm text-zinc-500">
            {profile.username === "you"
              ? "Start sharing your ideas with the Nexora community."
              : "Check back soon for new content."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {profile.articles.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}

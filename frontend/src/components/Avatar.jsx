import { getMediaUrl } from "../lib/media";

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Premium avatar: shows the user's profile photo when available,
 * otherwise a subtle initials placeholder. Never renders a broken image.
 */
export default function Avatar({ user, size = "md", className = "" }) {
  const name =
    user?.first_name || user?.last_name
      ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
      : user?.username || "";

  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-24 w-24 text-3xl",
  };

  const sizeCls = sizes[size] || sizes.md;

  if (user?.avatar) {
    return (
      <img
        src={getMediaUrl(user.avatar)}
        alt={name || "avatar"}
        className={`${sizeCls} shrink-0 rounded-full border border-white/10 object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeCls} flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-violet-500/30 to-indigo-600/30 font-semibold text-violet-200 ${className}`}
      aria-label={name || "avatar"}
    >
      {getInitials(name)}
    </div>
  );
}

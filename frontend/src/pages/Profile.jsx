import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Pencil, Eye, RefreshCw, X, Save } from "lucide-react";
import { getMyProfile, updateMyProfile, uploadMyAvatar } from "../services/users";
import { getMyPublishedArticles } from "../services/articles";
import { useAuth } from "../hooks/useAuth";
import { getMediaUrl } from "../lib/media";
import Avatar from "../components/Avatar";
import Seo from "../components/Seo";
import { privateMeta } from "../lib/seo";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BIO_LENGTH = 250;

export default function Profile() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [articleCount, setArticleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(""); // local preview before save

  // Redirect unauthenticated users
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Load profile + published article count
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    setLoading(true);
    setError("");
    getMyProfile()
      .then((p) => {
        setProfile(p);
        setFirstName(p.first_name || "");
        setLastName(p.last_name || "");
        setBio(p.bio || "");
        setAvatarPreview(p.avatar || "");
      })
      .catch((err) => setError(err.message || "Unable to load your profile."))
      .finally(() => setLoading(false));
  }, [authLoading, isAuthenticated]);

  // Fetch the published count from the dashboard endpoint (single source of truth)
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    getMyPublishedArticles()
      .then((res) => setArticleCount(res.count || 0))
      .catch(() => {});
  }, [authLoading, isAuthenticated]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const startEditing = () => {
    setFirstName(profile?.first_name || "");
    setLastName(profile?.last_name || "");
    setBio(profile?.bio || "");
    setAvatarPreview(profile?.avatar || "");
    setEditing(true);
    setError("");
  };

  const cancelEditing = () => {
    setEditing(false);
    setAvatarPreview(profile?.avatar || "");
  };

  const openImagePicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) handleAvatarSelect(file);
      input.value = "";
    };
    input.click();
  };

  const handleAvatarSelect = (file) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Only JPG, PNG, or WEBP images are allowed.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError("Image is too large. Maximum size is 5 MB.");
      return;
    }
    setError("");
    // Immediate local preview; upload happens on Save
    setAvatarPreview(URL.createObjectURL(file));
  };

  const removeAvatar = () => {
    setAvatarPreview("");
  };

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      let avatarPath = profile?.avatar || "";
      const fileSelected = avatarPreview.startsWith("blob:");

      if (fileSelected) {
        // Upload the pending file first
        setUploading(true);
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/jpeg,image/png,image/webp";
        // Re-read the file from the blob URL
        const blob = await fetch(avatarPreview).then((r) => r.blob());
        const ext = blob.type.split("/")[1] === "jpeg" ? "jpg" : blob.type.split("/")[1];
        const file = new File([blob], `avatar.${ext}`, { type: blob.type });
        const updated = await uploadMyAvatar(file);
        avatarPath = updated.avatar;
        setUploading(false);
      } else if (avatarPreview === "" && profile?.avatar) {
        avatarPath = ""; // removed
      }

      const updated = await updateMyProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        bio: bio.trim(),
        avatar: avatarPath,
      });

      setProfile(updated);
      setAvatarPreview(updated.avatar || "");
      setEditing(false);
      setToast("Profile updated");
    } catch (err) {
      setError(err.message || "Failed to save profile.");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm text-zinc-500">Loading your profile...</p>
        <div className="mt-8 space-y-4">
          <div className="h-24 w-24 rounded-full bg-white/[0.06] animate-pulse" />
          <div className="h-8 w-48 rounded bg-white/[0.06] animate-pulse" />
          <div className="h-4 w-32 rounded bg-white/[0.06] animate-pulse" />
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-8 text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full bg-white/10 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const displayName =
    profile.first_name || profile.last_name
      ? `${profile.first_name} ${profile.last_name}`.trim()
      : profile.username;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <Seo meta={privateMeta("Profile")} />
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {toast && (
        <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
          {toast}
        </div>
      )}

      {/* Profile Card */}
      <div className="card p-6 sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {/* Avatar */}
          <div className="relative">
            {editing ? (
              <div className="flex flex-col items-center gap-3">
                {avatarPreview ? (
                  <img
                    src={avatarPreview.startsWith("blob:") ? avatarPreview : getMediaUrl(avatarPreview)}
                    alt="Avatar preview"
                    className="h-24 w-24 rounded-full border border-white/10 object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-white/15 bg-white/[0.02] text-zinc-600">
                    <span className="text-xs">No photo</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={openImagePicker}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/[0.06]"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Change
                  </button>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={removeAvatar}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      <X className="h-3 w-3" />
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500">JPG, PNG or WEBP • Max 5 MB</p>
              </div>
            ) : (
              <Avatar user={profile} size="xl" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="firstName" className="mb-1.5 block text-xs font-medium text-zinc-500">First name</label>
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      className="input py-2.5"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="mb-1.5 block text-xs font-medium text-zinc-500">Last name</label>
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      className="input py-2.5"
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="bio" className="text-xs font-medium text-zinc-500">Bio</label>
                    <span className={`text-[11px] ${bio.length > MAX_BIO_LENGTH ? "text-red-400" : "text-zinc-500"}`}>
                      {bio.length}/{MAX_BIO_LENGTH}
                    </span>
                  </div>
                  <textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell readers a little about yourself..."
                    rows={3}
                    className="input resize-none py-2.5"
                  />
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold tracking-tight text-white">{displayName}</h2>
                <p className="mt-1 text-sm text-zinc-500">@{profile.username}</p>
                {profile.bio && (
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{profile.bio}</p>
                )}
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5">
                  <span className="text-lg font-bold text-white">{articleCount}</span>
                  <span className="text-xs text-zinc-500">
                    {articleCount === 1 ? "Story" : "Stories"} published
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap justify-center gap-3 border-t border-white/[0.06] pt-6 sm:justify-end">
          {editing ? (
            <>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || uploading}
                className="btn-primary"
              >
                <Save className="h-3.5 w-3.5" />
                {uploading ? "Uploading..." : saving ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={startEditing}
                className="btn-secondary"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Profile
              </button>
              <Link
                to={`/u/${profile.username}`}
                className="btn-primary"
              >
                <Eye className="h-3.5 w-3.5" />
                View Public Profile
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

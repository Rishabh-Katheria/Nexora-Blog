const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function parseError(response) {
  let message = "Request failed. Please try again.";
  try {
    const data = await response.json();
    const detail = data.detail;
    if (typeof detail === "string" && detail.trim()) {
      message = detail;
    } else if (Array.isArray(detail)) {
      const first = detail.find((d) => d && typeof d.msg === "string");
      if (first) message = first.msg;
    }
  } catch {
    // ignore parse errors
  }
  if (response.status >= 500) {
    message = "Something went wrong on our end. Please try again.";
  }
  throw new Error(message);
}

export async function loginUser(credentials) {
  const response = await fetch(`${API_URL}/api/auth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  if (!response.ok) await parseError(response);
  return response.json();
}

export async function registerUser(userData) {
  const response = await fetch(`${API_URL}/api/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });
  if (!response.ok) await parseError(response);
  return response.json();
}

export async function fetchCurrentUser(token) {
  const response = await fetch(`${API_URL}/api/auth/me/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) await parseError(response);
  return response.json();
}

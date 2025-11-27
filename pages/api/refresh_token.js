import { parse } from "cookie";

export default async function handler(req, res) {
  // Read refresh token from cookie
  const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
  const refresh_token = cookies.spotify_refresh_token;

  if (!refresh_token) {
    return res.status(401).json({ error: "No refresh token. Please login." });
  }

  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET;

  // Prepare POST body
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token,
    client_id,
    client_secret
  });

  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      return res.status(500).json({ error: "Failed to refresh token: " + text });
    }

    const data = await tokenRes.json(); // { access_token, expires_in, scope, token_type }
    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error during token refresh" });
  }
}

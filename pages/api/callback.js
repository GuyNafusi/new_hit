import fetch from "isomorphic-unfetch";
import { serialize } from "cookie";

export default async function handler(req, res) {
  const code = req.query.code || null;
  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirect_uri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/callback`;

  if (!code) {
    res.status(400).send("Missing code");
    return;
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri,
    client_id,
    client_secret
  });

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    res.status(500).send("Failed to exchange token: " + t);
    return;
  }

  const data = await tokenRes.json();
  // data: { access_token, token_type, expires_in, refresh_token, scope }

  // set refresh token in httpOnly cookie (so server can refresh later)
  res.setHeader("Set-Cookie", [
    serialize("spotify_refresh_token", data.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30 // 30 days (refresh token validity scenario)
    })
  ]);

  // redirect to front-end and pass access_token in query (short-lived)
  const frontend = process.env.NEXT_PUBLIC_BASE_URL || "/";
  const redirectTo = `${frontend}/?access_token=${data.access_token}&expires_in=${data.expires_in}`;
  res.redirect(redirectTo);
}

// Redirect user to Spotify authorize page
export default function handler(req, res) {
  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const redirect_uri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/callback`;
  const scope = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-modify-playback-state",
    "user-read-playback-state",
    "user-read-currently-playing"
  ].join(" ");

  const state = Math.random().toString(36).substring(2, 15);
  const params = new URLSearchParams({
    response_type: "code",
    client_id,
    scope,
    redirect_uri,
    state,
    show_dialog: "true"
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
}

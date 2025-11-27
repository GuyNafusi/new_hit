import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";

export default function Home() {
  const [accessToken, setAccessToken] = useState(null);
  const [trackInfo, setTrackInfo] = useState(null);
  const [userPremium, setUserPremium] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [status, setStatus] = useState("");

  const playerRef = useRef(null);
  const readerRef = useRef(null);

  const Html5QrcodeScanner =
    typeof window !== "undefined"
      ? require("html5-qrcode").Html5QrcodeScanner
      : null;

  const BASE = process.env.NEXT_PUBLIC_BASE_URL || "";

  // Get access_token from URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const at = url.searchParams.get("access_token");
    if (at) {
      setAccessToken(at);
      window.history.replaceState({}, document.title, "/");
      fetchUserProfile(at);
    }
  }, []);

  // Fetch user profile to detect Premium
  async function fetchUserProfile(token) {
    try {
      const res = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.product === "premium") setUserPremium(true);
    } catch (err) {
      console.error(err);
    }
  }

  // Setup Web Playback SDK
  useEffect(() => {
    if (!accessToken) return;
    if (!window.Spotify) {
      const tag = document.createElement("script");
      tag.src = "https://sdk.scdn.co/spotify-player.js";
      document.head.appendChild(tag);
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: "QR Player",
        getOAuthToken: (cb) => cb(accessToken),
        volume: 0.8,
      });
      playerRef.current = player;

      player.addListener("ready", ({ device_id }) => {
        setDeviceId(device_id);
        setStatus("Player ready ✔");
      });

      player.connect();
    };
  }, [accessToken]);

  // QR Scanner
  useEffect(() => {
    if (!Html5QrcodeScanner) return;

    const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
    readerRef.current = scanner;

    scanner.render(async (decodedText) => {
      if (!decodedText.includes("open.spotify.com/track")) {
        alert("Please scan a Spotify TRACK QR code");
        return;
      }
      const id = decodedText.split("/").pop().split("?")[0];
      fetchTrack(id);
    });

    return () => {
      try {
        readerRef.current?.clear();
      } catch {}
    };
  }, [accessToken]);

  // Fetch track info
  async function fetchTrack(id) {
    try {
      setStatus("Loading track…");
      const res = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      setTrackInfo({
        id: data.id,
        name: data.name,
        artists: data.artists.map((a) => a.name).join(", "),
        album: data.album.name,
        image: data.album.images[0]?.url,
        uri: data.uri,
        preview_url: data.preview_url,
      });
      setStatus("Track loaded ✔");
    } catch (err) {
      console.error(err);
      setStatus("Error loading track");
    }
  }

  // Play full track (Premium)
  async function playFullTrack() {
    if (!deviceId || !trackInfo) return alert("Player not ready or track missing");
    try {
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uris: [trackInfo.uri] }),
      });
      setStatus("Playing full track 🎵");
    } catch (err) {
      console.error(err);
      alert("Unable to play full track. Make sure you are Premium and player is ready.");
    }
  }

  // Play preview (Free)
  function playPreview() {
    if (!trackInfo) return alert("No track loaded");
    if (!trackInfo.preview_url) return alert("Preview not available for this track");
    const audio = new Audio(trackInfo.preview_url);
    audio.play();
    setStatus("Playing 30s preview 🎧");
  }

  function handleLogin() {
    window.location.href = "/api/login";
  }

  return (
    <div style={{ fontFamily: "Arial", padding: 20, textAlign: "center" }}>
      <Head>
        <title>Spotify QR Player</title>
      </Head>

      <h1>Spotify QR Player</h1>
      <p>{status}</p>

      {!accessToken && <button onClick={handleLogin}>Login with Spotify</button>}

      <div id="reader" style={{ width: 320, margin: "20px auto" }}></div>

      {trackInfo && (
        <div>
          <img src={trackInfo.image} style={{ width: 200, borderRadius: 10 }} />
          <h2>{trackInfo.name}</h2>
          <p>{trackInfo.artists}</p>

          {/* Buttons */}
          <div style={{ marginTop: 12 }}>
            {/* Full Track (Premium) */}
            <button
              onClick={playFullTrack}
              disabled={!userPremium}
              style={{
                padding: "8px 16px",
                marginRight: 8,
                cursor: userPremium ? "pointer" : "not-allowed",
              }}
            >
              Play Full Track (Premium)
            </button>

            {/* Preview (Free) */}
            <button
              onClick={playPreview}
              style={{
                padding: "8px 16px",
                cursor: "pointer",
              }}
            >
              Play Preview (Free)
            </button>
          </div>

          {!userPremium && (
            <p style={{ fontSize: "0.8em", marginTop: 8 }}>
              Full track requires Spotify Premium. Free users can listen to the 30s preview.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

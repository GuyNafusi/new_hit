import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";

export default function Home() {
  const [accessToken, setAccessToken] = useState(null);
  const [expiresIn, setExpiresIn] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [trackInfo, setTrackInfo] = useState(null);
  const [status, setStatus] = useState("");

  const playerRef = useRef(null);
  const readerRef = useRef(null);

  const Html5QrcodeScanner =
    typeof window !== "undefined"
      ? require("html5-qrcode").Html5QrcodeScanner
      : null;

  const BASE = process.env.NEXT_PUBLIC_BASE_URL || "";

  // Pull token from URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const at = url.searchParams.get("access_token");
    const exp = url.searchParams.get("expires_in");
    if (at) {
      setAccessToken(at);
      setExpiresIn(parseInt(exp || "3600", 10));
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  // Setup Spotify SDK
  useEffect(() => {
    if (!accessToken) return;

    const loadSDK = () => {
      const script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      document.body.appendChild(script);
    };

    if (!window.Spotify) loadSDK();

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: "QR Player",
        getOAuthToken: cb => cb(accessToken),
      });

      playerRef.current = player;

      player.addListener("ready", ({ device_id }) => {
        setDeviceId(device_id);
        setPlayerReady(true);
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

    scanner.render(async decodedText => {
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
        artists: data.artists.map(a => a.name).join(", "),
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

  async function handlePlay() {
    if (!trackInfo) return alert("Scan a track first!");

    const res = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: [trackInfo.uri] }),
      }
    );

    if (res.status !== 204) {
      alert("Unable to play (Premium required?)");
      return;
    }

    setStatus("Playing 🎵");
  }

  function handleLogin() {
    window.location.href = "/api/login";
  }

  return (
    <div style={{ fontFamily: "Arial", padding: 20 }}>
      <Head>
        <title>Spotify QR Player</title>
      </Head>

      <h1>Spotify QR Player</h1>
      <p>{status}</p>

      <button onClick={handleLogin}>Login with Spotify</button>

      <div id="reader" style={{ width: "320px", margin: "20px auto" }}></div>

      {trackInfo && (
        <div>
          <img
            src={trackInfo.image}
            style={{ width: 200, borderRadius: 10 }}
          />
          <h2>{trackInfo.name}</h2>
          <p>{trackInfo.artists}</p>

          <button onClick={handlePlay}>Play Full Track</button>

          {trackInfo.preview_url && (
            <div>
              <p>Preview (30s):</p>
              <audio controls src={trackInfo.preview_url}></audio>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

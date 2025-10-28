import hre from "hardhat";
import { ethers } from "ethers";
import axios from "axios";
import { URLSearchParams } from "url";
import dotenv from "dotenv";

dotenv.config();

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search";

function resolveInputs() {
  const [, , argSong, argArtist] = process.argv;
  const songName = process.env.SONG_NAME || argSong;
  const artistName = process.env.ARTIST_NAME || argArtist;
  if (!songName || !artistName) {
    throw new Error(
      "Provide SONG_NAME and ARTIST_NAME env vars (or pass them as arguments)."
    );
  }
  return { songName, artistName };
}

async function fetchClientCredentialsToken() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "Set SPOTIFY_ACCESS_TOKEN or SPOTIFY_CLIENT_ID/SECRET to look up tracks."
    );
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: id,
    client_secret: secret,
  });
  const res = await axios.post(SPOTIFY_TOKEN_URL, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return res.data.access_token;
}

async function getSpotifyToken() {
  if (process.env.SPOTIFY_ACCESS_TOKEN) {
    return process.env.SPOTIFY_ACCESS_TOKEN;
  }
  return fetchClientCredentialsToken();
}

async function searchTrack(songName, artistName) {
  let token = await getSpotifyToken();
  const hadAccessToken = !!process.env.SPOTIFY_ACCESS_TOKEN;
  const hasClientCreds =
    !!process.env.SPOTIFY_CLIENT_ID && !!process.env.SPOTIFY_CLIENT_SECRET;

  const queryTrack = async (authToken) => {
    try {
      const response = await axios.get(SPOTIFY_SEARCH_URL, {
        params: {
          q: `track:${songName} artist:${artistName}`,
          type: "track",
          limit: 1,
        },
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const [track] = response.data?.tracks?.items || [];
      if (!track) {
        throw new Error(
          `No Spotify track found for "${songName}" by "${artistName}".`
        );
      }
      return track;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 && hasClientCreds && hadAccessToken) {
        token = await fetchClientCredentialsToken();
        return queryTrack(token);
      }
      const detail =
        err?.response?.data?.error?.message ||
        err?.response?.data ||
        err.message;
      throw new Error(`Spotify search error (${status ?? "unknown"}): ${detail}`);
    }
  };

  return queryTrack(token);
}

async function main() {
  const { songName, artistName } = resolveInputs();
  console.log(
    `Searching Spotify track for song="${songName}" artist="${artistName}"...`
  );

  const track = await searchTrack(songName, artistName);
  const trackId = track.id;
  const canonicalName = track.name;
  const primaryArtists = (track.artists || []).map((a) => a.name).join(", ");
  console.log(`Found track: ${canonicalName} by ${primaryArtists} (id=${trackId})`);

  const connection = await hre.network.connect();

  const [deployer] = await connection.ethers.getSigners();
  const oracle = deployer;

  const Vybe = await connection.ethers.getContractFactory("VybePredictionMarket");
  const vybe = await Vybe.deploy(oracle.address);
  await vybe.waitForDeployment();

  console.log("VybePredictionMarket:", await vybe.getAddress());
  console.log("Deployer:", deployer.address);
  console.log("Oracle:", oracle.address);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});

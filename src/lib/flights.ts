/**
 * Recherche de vols réels via l'API Amadeus for Developers.
 *
 * - Flights Offers Search : vols (compagnie + n° de vol, horaires, escales) entre
 *   deux aéroports à une date — exploitables pour planifier un fret aérien.
 * - Compte gratuit sur https://developers.amadeus.com →clés « Self-Service » :
 *   AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET dans .env (AMADEUS_ENV=test ou production).
 * - Sans configuration, la fonction renvoie un état explicite — jamais de vol inventé.
 */

export interface FlightSegment {
  flightNumber: string; // ex : AF982
  airline: string; // code transporteur IATA (ex : AF)
  from: string;
  to: string;
  departAt: string;
  arriveAt: string;
}

export interface FlightResult {
  key: string;
  airline: string;
  flightNumber: string; // premier segment (ou « AF982 + TK526 » si correspondance)
  from: string;
  to: string;
  departAt: string;
  arriveAt: string;
  stops: number;
  segments: FlightSegment[];
}

interface TokenCache {
  token: string;
  expiresAt: number;
}
const globalForFlights = globalThis as unknown as { __amadeusToken?: TokenCache };

export function isFlightsConfigured(): boolean {
  return Boolean(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET);
}

function apiHost(): string {
  return process.env.AMADEUS_ENV === "production" ? "https://api.amadeus.com" : "https://test.api.amadeus.com";
}

async function getToken(): Promise<string> {
  const cached = globalForFlights.__amadeusToken;
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const res = await fetch(apiHost() + "/v1/security/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.AMADEUS_CLIENT_ID ?? "",
      client_secret: process.env.AMADEUS_CLIENT_SECRET ?? "",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Authentification Amadeus échouée (HTTP ${res.status}). Vérifiez AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET.`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  globalForFlights.__amadeusToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

export async function searchFlights(from: string, to: string, date: string): Promise<FlightResult[]> {
  if (!isFlightsConfigured()) {
    throw new Error("API vols non configurée : créez un compte gratuit sur developers.amadeus.com puis renseignez AMADEUS_CLIENT_ID et AMADEUS_CLIENT_SECRET dans le fichier .env (voir README §Vols).");
  }
  const token = await getToken();
  const url =
    `${apiHost()}/v2/shopping/flight-offers` +
    `?originLocationCode=${encodeURIComponent(from)}&destinationLocationCode=${encodeURIComponent(to)}` +
    `&departureDate=${encodeURIComponent(date)}&adults=1&max=12&currencyCode=EUR&nonStop=false`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Amadeus HTTP ${res.status}${body ? " : " + body.slice(0, 200) : ""}`);
  }
  const json = (await res.json()) as {
    data?: Array<{
      itineraries?: Array<{
        segments?: Array<{
          carrierCode?: string;
          number?: string;
          departure?: { iataCode?: string; at?: string };
          arrival?: { iataCode?: string; at?: string };
        }>;
      }>;
    }>;
    included?: Record<string, { name?: string }>;
  };

  const flights: FlightResult[] = [];
  for (const offer of json.data ?? []) {
    const itinerary = offer.itineraries?.[0];
    const segs = itinerary?.segments ?? [];
    if (segs.length === 0) continue;
    const segments: FlightSegment[] = segs.map((s) => ({
      flightNumber: `${s.carrierCode ?? ""}${s.number ?? ""}`,
      airline: s.carrierCode ?? "",
      from: s.departure?.iataCode ?? "",
      to: s.arrival?.iataCode ?? "",
      departAt: s.departure?.at ?? "",
      arriveAt: s.arrival?.at ?? "",
    }));
    const first = segments[0];
    const last = segments[segments.length - 1];
    flights.push({
      key: segments.map((s) => s.flightNumber).join("-"),
      airline: first.airline,
      flightNumber: segments.map((s) => s.flightNumber).join(" + "),
      from: first.from,
      to: last.to,
      departAt: first.departAt,
      arriveAt: last.arriveAt,
      stops: segments.length - 1,
      segments,
    });
  }
  return flights;
}

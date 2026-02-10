/**
 * Haversine distance in meters between two lat/lng points.
 */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Haversine distance helper for objects with {lat, lng} properties.
 */
function haversineDist(a, b) {
  return haversine(a.lat, a.lng, b.lat, b.lng);
}

/**
 * Bearing in degrees from point 1 to point 2.
 */
function bearing(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return ((toDeg(Math.atan2(y, x)) % 360) + 360) % 360;
}

/**
 * Given GPS samples and a time range (start/finish in cts ms),
 * compute per-sample: speed (m/s), acceleration (m/s²), yaw (degrees heading).
 */
export function computeMetrics(gpsSamples, startCts, finishCts) {
  const filtered = gpsSamples.filter((s) => s.cts >= startCts && s.cts <= finishCts);
  if (filtered.length < 2) return [];

  const results = [];
  for (let i = 0; i < filtered.length; i++) {
    const curr = filtered[i];
    const prev = i > 0 ? filtered[i - 1] : null;

    // Speed from GPS (use built-in speed2D if available, else compute)
    let speed = curr.speed2D || 0;
    if (!speed && prev) {
      const dist = haversine(prev.lat, prev.lng, curr.lat, curr.lng);
      const dt = (curr.cts - prev.cts) / 1000;
      speed = dt > 0 ? dist / dt : 0;
    }

    results.push({
      cts: curr.cts,
      raceTime: (curr.cts - startCts) / 1000, // seconds since start
      lat: curr.lat,
      lng: curr.lng,
      speed,
      speedMph: speed * 2.23694,
    });
  }
  return results;
}

/**
 * Compute yaw rate (°/s) from gyroscope Z-axis, filtered to the race window.
 * Returns array of { raceTime, yawRate } matched to GPS sample times.
 */
export function computeYawRate(gyroSamples, startCts, finishCts) {
  const filtered = gyroSamples.filter((s) => s.cts >= startCts && s.cts <= finishCts);
  return filtered.map((s) => ({
    cts: s.cts,
    raceTime: (s.cts - startCts) / 1000,
    yawRate: s.z * (180 / Math.PI), // rad/s → °/s
  }));
}

/**
 * Integrate speed over time to get cumulative distance along track for each sample.
 * Adds a `dist` property (meters from start) to each metric entry.
 */
function addCumulativeDistance(metrics) {
  let cumDist = 0;
  for (let i = 0; i < metrics.length; i++) {
    if (i === 0) {
      metrics[i].dist = 0;
    } else {
      const dt = (metrics[i].cts - metrics[i - 1].cts) / 1000; // seconds
      const avgSpeed = (metrics[i].speed + metrics[i - 1].speed) / 2; // m/s, trapezoidal
      cumDist += avgSpeed * dt;
      metrics[i].dist = cumDist;
    }
  }
}

/**
 * Find where the comparison video crosses start/finish based on
 * proximity to the start/finish GPS coordinates from "your" video.
 */
export function findCompBounds(compGps, startGps, finishGps) {
  // Find closest point to start
  let minStartDist = Infinity, startIdx = 0;
  let minFinishDist = Infinity, finishIdx = compGps.length - 1;
  for (let i = 0; i < compGps.length; i++) {
    const ds = haversine(compGps[i].lat, compGps[i].lng, startGps.lat, startGps.lng);
    if (ds < minStartDist) { minStartDist = ds; startIdx = i; }
  }
  // Find closest to finish AFTER start
  for (let i = startIdx + 1; i < compGps.length; i++) {
    const df = haversine(compGps[i].lat, compGps[i].lng, finishGps.lat, finishGps.lng);
    if (df < minFinishDist) { minFinishDist = df; finishIdx = i; }
  }
  return { startIdx, finishIdx, startCts: compGps[startIdx].cts, finishCts: compGps[finishIdx].cts };
}

/**
 * Compute time delta at each point in "your" race by matching on
 * cumulative distance (integrated from speed), not GPS position.
 *
 * Delta = yourTime(d) - compTime(d) at each distance d.
 * Positive = you are slower (behind coach). Negative = you are faster.
 */
export function computeTimeDelta(yourMetrics, compMetrics) {
  // Add cumulative distance to both traces
  addCumulativeDistance(yourMetrics);
  addCumulativeDistance(compMetrics);

  const compTotalDist = compMetrics[compMetrics.length - 1].dist;
  let compIdx = 0;

  return yourMetrics.map((ym) => {
    const d = ym.dist;

    // Clamp to comp's total distance
    if (d > compTotalDist) {
      const comp = compMetrics[compMetrics.length - 1];
      return {
        raceTime: ym.raceTime, cts: ym.cts, dist: d,
        delta: ym.raceTime - comp.raceTime,
        compCts: comp.cts, compRaceTime: comp.raceTime,
        lat: ym.lat, lng: ym.lng,
      };
    }

    // Walk compIdx forward to bracket the distance
    while (compIdx < compMetrics.length - 1 && compMetrics[compIdx + 1].dist < d) {
      compIdx++;
    }

    // Linearly interpolate comp's raceTime and cts at distance d
    const c0 = compMetrics[compIdx];
    const c1 = compMetrics[Math.min(compIdx + 1, compMetrics.length - 1)];
    const segLen = c1.dist - c0.dist;
    const t = segLen > 0 ? (d - c0.dist) / segLen : 0;
    const compRaceTime = c0.raceTime + t * (c1.raceTime - c0.raceTime);
    const compCts = c0.cts + t * (c1.cts - c0.cts);

    return {
      raceTime: ym.raceTime, cts: ym.cts, dist: d,
      delta: ym.raceTime - compRaceTime,
      compCts, compRaceTime,
      lat: ym.lat, lng: ym.lng,
    };
  });
}

/**
 * Detect all crossings of a start/finish point in circuit mode.
 * Groups consecutive nearby GPS samples into single "crossings".
 * Returns array of CTS timestamps (middle of each crossing cluster).
 */
export function detectLapCrossings(gpsSamples, startLat, startLng, radiusMeters = 20) {
  if (!gpsSamples || gpsSamples.length === 0) return [];

  // Find all samples within radius
  const nearbyIndices = [];
  for (let i = 0; i < gpsSamples.length; i++) {
    const dist = haversine(gpsSamples[i].lat, gpsSamples[i].lng, startLat, startLng);
    if (dist <= radiusMeters) {
      nearbyIndices.push(i);
    }
  }

  if (nearbyIndices.length === 0) return [];

  // Group consecutive indices into clusters
  const clusters = [];
  let currentCluster = [nearbyIndices[0]];

  for (let i = 1; i < nearbyIndices.length; i++) {
    // If gap > 1 index, start new cluster
    if (nearbyIndices[i] - nearbyIndices[i - 1] > 1) {
      clusters.push(currentCluster);
      currentCluster = [nearbyIndices[i]];
    } else {
      currentCluster.push(nearbyIndices[i]);
    }
  }
  clusters.push(currentCluster);

  // Get middle CTS of each cluster
  return clusters.map((cluster) => {
    const midIdx = cluster[Math.floor(cluster.length / 2)];
    return gpsSamples[midIdx].cts;
  });
}

/**
 * Find laps from crossing timestamps.
 * Returns array of { lapNumber, startCts, finishCts, durationSec }.
 */
export function findLaps(gpsSamples, crossings) {
  if (!crossings || crossings.length < 2) return [];

  const laps = [];
  for (let i = 0; i < crossings.length - 1; i++) {
    const startCts = crossings[i];
    const finishCts = crossings[i + 1];
    const durationSec = (finishCts - startCts) / 1000;

    laps.push({
      lapNumber: i + 1,
      startCts,
      finishCts,
      durationSec,
    });
  }

  return laps;
}


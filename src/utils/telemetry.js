import gpmfExtract from 'gpmf-extract';
import goproTelemetry from 'gopro-telemetry';

/**
 * Extract GPS + sensor telemetry from a GoPro video file.
 * Returns { gps: [...], accel: [...], gyro: [...] }
 * Each GPS sample: { cts, lat, lng, alt, speed2D, speed3D }
 * Each accel sample: { cts, x, y, z }
 * Each gyro sample: { cts, x, y, z }
 */
export async function extractTelemetry(file, onProgress) {
  // Step 1: extract raw GPMF binary from MP4
  const extracted = await gpmfExtract(file, {
    browserMode: true,
    useWorker: false,
    progress: onProgress,
  });

  // Step 2: parse into structured telemetry
  const telemetry = await goproTelemetry(
    { rawData: extracted.rawData, timing: extracted.timing },
    { stream: ['GPS5', 'GPS9', 'ACCL', 'GYRO', 'GRAV'], repeatSticky: true }
  );

  const gps = [];
  const accel = [];
  const gyro = [];
  const gravity = [];

  // Iterate devices and streams
  for (const deviceId of Object.keys(telemetry)) {
    const device = telemetry[deviceId];
    if (!device.streams) continue;

    for (const streamKey of Object.keys(device.streams)) {
      const stream = device.streams[streamKey];
      const samples = stream.samples || [];

      if (streamKey === 'GPS5' || streamKey === 'GPS9') {
        for (const s of samples) {
          if (!s.value) continue;
          const v = s.value;
          // GPS5: [lat, lng, alt, speed2D, speed3D]
          // GPS9: [lat, lng, alt, speed2D, speed3D, ?, ?, ?, ?]
          gps.push({
            cts: s.cts,
            date: s.date,
            lat: v[0],
            lng: v[1],
            alt: v[2],
            speed2D: v[3],
            speed3D: v[4],
            fix: s.sticky?.GPSA || s.sticky?.GPSF || null,
            precision: s.sticky?.GPSP || null,
          });
        }
      } else if (streamKey === 'ACCL') {
        for (const s of samples) {
          if (!s.value) continue;
          accel.push({ cts: s.cts, x: s.value[1], y: s.value[2], z: s.value[0] });
        }
      } else if (streamKey === 'GYRO') {
        for (const s of samples) {
          if (!s.value) continue;
          gyro.push({ cts: s.cts, x: s.value[1], y: s.value[2], z: s.value[0] });
        }
      } else if (streamKey === 'GRAV') {
        for (const s of samples) {
          if (!s.value) continue;
          gravity.push({ cts: s.cts, x: s.value[0], y: s.value[1], z: s.value[2] });
        }
      }
    }
  }

  // Sort by cts
  gps.sort((a, b) => a.cts - b.cts);
  accel.sort((a, b) => a.cts - b.cts);
  gyro.sort((a, b) => a.cts - b.cts);
  gravity.sort((a, b) => a.cts - b.cts);

  return { gps, accel, gyro, gravity };
}


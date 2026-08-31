import os from "os";

/** Best-effort LAN IPv4 address, so QR codes/links work from a student's phone
 *  regardless of what hostname the teacher's own browser happens to be using
 *  (localhost, 127.0.0.1, etc.). Shared by routes/system.ts and routes/courses.ts. */
export function getLocalIp(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

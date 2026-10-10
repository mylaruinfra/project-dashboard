import { clearSessionCookie } from "@/server/auth/session";
import { publicRoute } from "@/server/http/route";

export const POST = publicRoute(async () => {
  await clearSessionCookie();
  return null;
});

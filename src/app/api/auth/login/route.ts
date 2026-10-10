import { z } from "zod";
import { setSessionCookie } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { publicRoute, readJson } from "@/server/http/route";
import { authenticate } from "@/server/services/users.service";

const input = z.object({ email: z.string().trim().min(1, "Enter your email"), password: z.string().min(1, "Enter your password") });

export const POST = publicRoute(async (req) => {
  const { email, password } = input.parse(await readJson(req));
  const user = await authenticate(email, password);
  if (!user) throw new AppError("UNAUTHENTICATED", "Email or password is wrong.", { password: "Email or password is wrong." });
  await setSessionCookie(user);
  return { name: user.name, role: user.role };
});

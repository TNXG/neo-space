import createMiddleware from "next-intl/middleware";
import { routing } from "@/locales";

export default createMiddleware(routing);

export const config = {
  matcher: [
    "/((?!api|feed|_next|_vercel|.*\\..*).*)",
  ],
};

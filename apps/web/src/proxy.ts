import createMiddleware from "next-intl/middleware";
import { routing } from "@/locales";

export default createMiddleware(routing);

export const config = {
  matcher: [
    "/((?!api|feed|_next|_vercel|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|avif|css|js|mjs|map|woff|woff2|ttf|eot|otf|txt|xml|json|wasm|mp3|mp4|webm|pdf)$).*)",
  ],
};

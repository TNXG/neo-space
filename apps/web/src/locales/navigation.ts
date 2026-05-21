import { createNavigation } from "next-intl/navigation";
import { routing } from "./index";

export const {
  Link,
  redirect,
  usePathname,
  useRouter,
  getPathname,
} = createNavigation(routing);

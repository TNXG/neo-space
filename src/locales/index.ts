import { hasLocale } from "next-intl";
import { defineRouting } from "next-intl/routing";
import { getRequestConfig } from "next-intl/server";

export const routing = defineRouting({
  locales: ["zh", "ja", "en"],
  defaultLocale: "zh",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];

type FlatMessages = Record<string, string>;
interface NestedMessages {
  [key: string]: NestedMessages | string;
}

function nestMessages(flatMessages: FlatMessages): NestedMessages {
  const nestedMessages: NestedMessages = {};

  for (const [flatKey, value] of Object.entries(flatMessages)) {
    const keyParts = flatKey.split(".");
    let currentLevel: NestedMessages = nestedMessages;

    keyParts.forEach((keyPart, index) => {
      const isLeafKey = index === keyParts.length - 1;

      if (isLeafKey) {
        currentLevel[keyPart] = value;
        return;
      }

      const currentValue = currentLevel[keyPart];
      if (!currentValue || typeof currentValue === "string") {
        currentLevel[keyPart] = {};
      }

      currentLevel = currentLevel[keyPart] as NestedMessages;
    });
  }

  return nestedMessages;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale;
  const locale = hasLocale(routing.locales, requestedLocale)
    ? requestedLocale
    : routing.defaultLocale;

  const flatMessages = (await import(`./messages/${locale}.json`)).default as FlatMessages;

  return {
    locale,
    messages: nestMessages(flatMessages),
  };
});

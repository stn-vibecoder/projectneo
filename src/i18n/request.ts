import { getRequestConfig } from "next-intl/server";

// Grensesnittet er på norsk (bokmål). Engelsk legges til ved å lage
// src/messages/en.json og velge locale fra profil eller cookie her.
export const DEFAULT_LOCALE = "nb";
export const TIME_ZONE = "Europe/Oslo";

export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE;
  return {
    locale,
    timeZone: TIME_ZONE,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

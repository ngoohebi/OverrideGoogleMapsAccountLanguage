# Chrome Web Store listing — Maps Language Override

Copy these into the Developer Dashboard (Store listing / Privacy tabs).

## Name
Maps Language Override

## Summary (max 132 chars)
Read Google Maps in the local language — real place names and local addresses — instead of the language forced by your Google Account.

## Category
Tools  (alternative: Travel)

## Language
English

## Description
When you are signed in, Google Maps always shows itself in your Google Account language. Abroad, that gets in the way:

• Place names, streets and stations are translated or transliterated into your language, so they no longer match the signs you see on the street.
• Addresses are rewritten in your language ("4 Chome-2-8 Shibakoen, Minato City") instead of the local form ("〒105-0011 東京都港区芝公園４丁目２−８"), which is the one a taxi driver, a delivery form, a local app or a building's signboard actually uses.
• Machine translation of names, menus and reviews is often awkward, and the original local text is hard to find.

Changing your whole Google Account language just for one trip is not an option.

Maps Language Override fixes this with one click. Pick a language from the toolbar popup, and every Google Maps page opens in that language: the map labels, place names, addresses and interface all show local text, while your account settings stay untouched. Switch it back to "Off" at any time to return to your account language.

Features
• All 74 interface languages the Google Maps website supports (each one verified), shown with their native names (日本語, 한국어, 中文（台灣）, ไทย, Tiếng Việt, …), searchable.
• Not in the list? Type any language code into the search and pick it the same way.
• Applies to the open Maps tab immediately and to every Maps page afterwards, on google.com and all country domains (google.co.jp, google.com.tw, …) and maps.google.com.
• The toolbar icon is only active on Google Maps pages; everywhere else it is greyed out. Hover it to see the active language.
• Your choice syncs across your Chrome browsers.
• No tracking, no data collection, no remote code. Open source.

How it works
Google Maps accepts a language parameter in the address (hl=ja). The extension adds that parameter to Google Maps page loads with Chrome's declarativeNetRequest API. It never reads the content of pages.

Source code: https://github.com/ngoohebi/OverrideGoogleMapsAccountLanguage

## Images
- Icon: extension/icons/icon128.png
- Screenshots (1280×800): store/images/screenshot-1.png, store/images/screenshot-2.png
- Small promo tile (440×280): store/images/promo-small.png

## Privacy tab

**Single purpose**
Show Google Maps in a language the user chooses instead of the Google Account language, by adding the hl language parameter to Google Maps page addresses.

**Permission justifications**
- storage: Saves the one language code the user picked (synced through Chrome sync) so it applies to future Google Maps visits.
- declarativeNetRequest: Adds or replaces the hl=<language> parameter on Google Maps page loads (main-frame only). Rules are limited to google.<domain>/maps and maps.google.<domain> addresses.
- Host permissions (Google domains): Required by Chrome for declarativeNetRequest redirects on those sites, to tell whether a tab is a Google Maps page (so the toolbar icon is only active there), and to reload the active Google Maps tab with the chosen language from the popup. Only Google's own domains (from google.com/supported_domains) are listed; page content is never read.

**Remote code**
No, I am not using remote code.

**Data usage**
Collects none of the listed data types. Certify all three disclosures.

**Privacy policy URL**
https://github.com/ngoohebi/OverrideGoogleMapsAccountLanguage/blob/main/PRIVACY.md

# Map quick-add and Google Maps integration spec

> Goal: a sevadar should be able to put their bhandara on the map in **under 60 seconds** on a phone, with no typing of latitude/longitude. Devotees should be able to open any bhandara in **Google Maps in one tap** for live navigation.

---

## 1. The two flows

### Flow A — Organizer adds a bhandara to the map (≤ 60 seconds)

The current form asks for an address as text and an optional lat/lng. That's why people don't fill it. New flow:

```
1. Organizer hits "List your bhandara" CTA.
2. App requests location permission (with explanation: "We use your location only to drop the pin where you're standing — never tracked.").
3. If granted: a fullscreen map opens centered on the user's GPS location, pin pre-dropped at center.
4. The pin is draggable. The user can fine-tune by dragging.
5. Above the map: an autocomplete search bar (Google Places autocomplete or OSM Nominatim) — typing "Aliganj police chowki" suggests addresses; tapping one moves the pin.
6. Below the map: a single "Confirm location" button. On tap, capture lat, lng, AND a reverse-geocoded human address.
7. App advances to the next step of the form (name, time, menu, etc.), all of which are short.
8. If location permission denied: skip step 3 and go straight to autocomplete-only mode.
```

The whole map step is ONE screen on mobile. No address typing required.

### Flow B — Devotee opens a bhandara in Google Maps (one tap)

On every detail page, prominent "Get directions" button. On tap:

```
window.open(
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${optionalPlaceId}`,
  "_blank"
);
```

This opens Google Maps app on Android and iOS (universal link), or Google Maps web on desktop, with live driving / walking directions ready to start.

For pure pin display (no directions yet), use:

```
https://www.google.com/maps/search/?api=1&query=${lat},${lng}
```

For sharing as a Google Maps URL (organizer can post it), generate:

```
https://www.google.com/maps?q=${lat},${lng}&z=18
```

---

## 2. Tech choices

### Map provider for the form quick-add

Two options. Pick **Option A** unless there's a budget reason not to.

**Option A — Google Places + Google Maps JS API (recommended)**
- Best autocomplete in India by far (Hinglish addresses, landmark-based search, recent OSM weakness on Lucknow gullies).
- Cost: free up to 10K loads / month, 6K autocompletes — enough for season 1.
- Setup: provision a Maps API key; restrict by HTTP referrer to badamangal.com.
- Library: `@vis.gl/react-google-maps` for the map and `@googlemaps/js-api-loader` for places.

**Option B — Leaflet + OSM Nominatim (free, good enough)**
- Already in the stack.
- Use `nominatim.openstreetmap.org/search?q=...&countrycodes=in` for autocomplete.
- Slightly weaker on landmark-based queries but fine for first season.
- Zero API cost.
- Add `https://nominatim.org/release-docs/latest/api/Search/` rate-limit-friendly debouncing (250ms).

For launch this week, **stay with Leaflet + Nominatim**. Migrate to Google Places after the first season if the autocomplete quality bothers users.

### Reverse geocoding

When the user drops a pin, we want a human-readable address auto-filled into the `address` field.

- Nominatim reverse: `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
- Google Geocoding API: `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${KEY}`

Cache results client-side for the duration of the form session — no need to re-query if pin doesn't move.

---

## 3. UX details

- **Permission ask copy:** "We'll use your location only to drop the pin. Nothing is tracked." (Hindi: "हम आपकी लोकेशन सिर्फ़ pin लगाने के लिए इस्तेमाल करते हैं। कुछ भी track नहीं होता।")
- **First-time open** of the map step: zoom level 17 (street level), pin pre-dropped at GPS center if available, else at Lucknow center (26.8467, 80.9462) with zoom 12.
- **Pin sprite:** the gada-shaped marker from `ai-image-prompts.md §4` (or a placeholder until that's ready).
- **Drag affordance:** when the pin starts at center and the map is loaded, animate a subtle bounce on the pin for the first 1.5s, then fade out. Tells the user it's draggable without copy.
- **Autocomplete behavior:** debounce 250ms; suggestions render as a card list under the search bar with the address line and the area name.
- **Confirm button state:** stays in the saffron primary color; only enables when a pin is actually placed (not just default Lucknow center, unless the user explicitly confirms).
- **Accessibility:** the autocomplete must be keyboard-navigable; the map must have a "Use address instead" fallback button that opens a manual address form for users on poor connections.

---

## 4. Data model implications

The current Bhandara model has `lat`, `lng`, and `address`. Add:

```prisma
googlePlaceId   String?  // optional, populated if user picked from Google autocomplete
googleMapsUrl   String?  // computed at write time so detail pages can render it instantly
```

Also store the **reverse-geocoded** structured address (city, neighborhood) so we can group bhandaras into accurate areas without trusting user-typed input:

```prisma
geo_neighborhood String?  // e.g. "Aliganj"
geo_district     String?  // e.g. "Lucknow"
geo_state        String?  // e.g. "Uttar Pradesh"
```

`area` (the existing field) remains the user-facing tag from a curated list. `geo_neighborhood` is the truth from the geocoder. They can disagree gracefully.

---

## 5. Detail page CTA stack (mobile sticky bottom bar)

Three buttons, equal width, on a sticky bottom bar that appears once the user scrolls past the hero on mobile:

```
[ 🧭 Directions ]   [ 💬 WhatsApp ]   [ 🪔 Sponsor ]
```

(Replace emoji with proper SVG icons in production — use the gada bullet for the sponsor button.)

- **Directions**: deep links to Google Maps as in Flow B.
- **WhatsApp**: `https://wa.me/?text=...` with prefilled bilingual share copy.
- **Sponsor**: opens UPI deep link if `upiId` set; otherwise opens a "Coming soon" sheet with "Send the organizer some seva" copy + the organizer's phone number.

On desktop, render these inline below the hero.

---

## 6. Lucknow Map default styling

Tweak the OSM tile layer to match the brand:

- Base tile URL: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- Apply a CSS filter on the tile layer:

```css
.leaflet-tile {
  filter: saturate(0.85) sepia(0.15) brightness(1.02);
}
```

This warms up the map tiles to match the cream/saffron palette. Test on dark mode separately.

For premium feel later: switch to MapTiler's "Outdoor" or a custom Mapbox style. Out of scope for week-1 launch.

---

## 7. Error states

- **Geolocation denied:** show a small banner: "No problem — search for the address below."
- **Geolocation timeout (>10s):** fall back to map default and show same banner.
- **Pin outside Lucknow district bounding box** (lat 26.7–27.0, lng 80.8–81.1): show a soft warning: "This looks like it's outside Lucknow. Are you sure?" with a Continue/Cancel.
- **Reverse geocoding fails:** allow submission with empty `address` field — the lat/lng is what matters.

---

## 8. Acceptance test

A volunteer who has never used the site:

1. Opens BadaMangal.com on their phone.
2. Taps "List your bhandara".
3. Allows location.
4. Sees the map open at their actual street.
5. Drags the pin a few meters to the exact stove.
6. Taps Confirm.
7. Fills the rest of the form (name, time, menu) in under 60 seconds.
8. Submits.

If any step takes more than 10 seconds for a non-technical user, we ship a fix before launch.

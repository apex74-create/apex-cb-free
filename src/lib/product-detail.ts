/**
 * Long-form selling copy for the flagship products.
 *
 * The catalogue row carries the name, price, status and one-line tagline. This
 * module carries the part a buyer actually reads before paying: the hook, the
 * specifications, the situations it is for, and what is honestly not included.
 *
 * Nothing here may state a capability the build does not have.
 */

export type SpecRow = { label: string; value: string };
export type UseCase = { title: string; body: string };

export type ProductDetail = {
  /** One sentence that has to earn the sale on its own. */
  hook: string;
  /** Two or three paragraphs under the hook. */
  pitch: string[];
  specs: SpecRow[];
  useCases: UseCase[];
  /** Plain statement of limits — keeps the page honest. */
  limits: string[];
};

export const PRODUCT_DETAIL: Record<string, ProductDetail> = {
  "apex-signal-watch": {
    hook: "Talk, map and sense the radio picture around you without trusting a single network to stay up.",
    pitch: [
      "Most secure messengers protect the words and leak everything else — who you spoke to, when, and from where. Apex Signal scrambles, signs and meters on the device before anything leaves it, so whatever carries the bytes afterwards is just a pipe. Carrier data, Wi-Fi, a relay on your own hardware: the protection does not change.",
      "It runs on a phone, a tablet, a Chromebook and on the wrist. The watch screen is built with no framework, no canvas and no network dependency, because the cheap displays it targets fall over on all three. What you get on the watch is the same channel, not a cut-down remote control.",
      "Every transmission carries a signed, hash-linked record. That is not decoration — it is what lets you prove afterwards that a message was sent, in what order, and that nothing in the chain was altered.",
    ],
    specs: [
      { label: "Runs on", value: "Android phone, tablet, Chromebook, wearable browser, desktop" },
      { label: "Install", value: "Installable web app today; signed Android package when the release key is in place" },
      { label: "Voice", value: "Push-to-talk across numbered channels, with roster and squelch" },
      { label: "Text", value: "Mesh chat with signed, hash-linked delivery records" },
      { label: "Encryption", value: "On-device signing and key derivation; no key-exchange message on the wire" },
      { label: "Sensing", value: "Ambient radio picture from the browser alone — no cable, no bridge, no root" },
      { label: "Mapping", value: "Signal map, radar sweep, sextant and level tools" },
      { label: "Weather", value: "Enphase Operator forecast included with this licence" },
      { label: "Offline", value: "Full offline boot; queued writes flush when a link returns" },
      { label: "Accounts", value: "One account, one licence, every device you own" },
    ],
    useCases: [
      {
        title: "A crew with no coverage to rely on",
        body: "Numbered channels, a roster and squelch behave the way a radio operator already expects, so nobody has to learn a messaging app in the field. When the carrier is there it is used; when it is not, the same channel keeps working over whatever link you do have.",
      },
      {
        title: "Knowing what is around you before you commit",
        body: "The ambient panel reads the radio and network picture from the browser itself — no cable to the handset, no special access. It reports the surrounding signal environment, not individual people or devices, which is exactly the line the provenance record draws and holds.",
      },
      {
        title: "A record that stands up afterwards",
        body: "Each delivery carries its own signed, chained record. If an exchange is ever questioned, the order and integrity of the chain can be checked rather than argued about.",
      },
      {
        title: "On the wrist, genuinely",
        body: "The watch screen loads on displays that choke on modern web apps, and keeps working with the phone in a pocket or a pack.",
      },
    ],
    limits: [
      "The deeper device-level tools need the phone bridge agent, which is the least reliable part of the system — nothing essential depends on it.",
      "The signed Android package is not published yet; it needs the owner's release signing key.",
    ],
  },

  "enphase-operator": {
    hook: "A forecast that tells you the one day the heat peaks — and shows you the measurements it is standing on.",
    pitch: [
      "Ordinary forecasts hand you a row of daily icons and leave the judgement to you. This one answers a different question: across a held window, which single day is the peak, how hot, and how sure. That is the answer a grower, an operator or a contractor actually schedules against.",
      "It leads with measurement. Live observed readings for your location carry first weight, matched historical years back to 1950 carry second, and the synthesised projection carries third — filling only where measurement cannot reach. Confidence falls as the projection stretches from the last real reading, so a number far out cannot masquerade as a number close in.",
      "The method crunches raw observation arrays rather than re-presenting somebody else's finished forecast, and the engine runs inside the product. When every outside model host is unreachable — and they have been — the dashboard keeps answering and says plainly that it is running on its own.",
    ],
    specs: [
      { label: "Output", value: "Peak date, peak value, confidence figure, held window" },
      { label: "Inputs", value: "Observed daily highs, surface pressure, dew-point spread, wind" },
      { label: "History", value: "Matched analog years from 1950 to today, matched on strength and timing" },
      { label: "Horizon", value: "Scrollable timeline across past readings and forward projection" },
      { label: "Chart", value: "Measured days, today, projection and matched years drawn together; drag to pan, wheel to zoom" },
      { label: "Window", value: "Held window shown on the chart so the answer cannot be cherry-picked from a wider range" },
      { label: "Alerts", value: "Alert on the peak date" },
      { label: "Resilience", value: "Local engine answers with no external model host; status shown honestly" },
      { label: "Location", value: "Any coordinates; defaults to the operator's home location" },
    ],
    useCases: [
      {
        title: "Scheduling against the peak, not the average",
        body: "Pours, harvests, burns, cuts and load planning all turn on the hottest day in a window rather than the weekly mean. The dashboard names that day and puts a confidence figure next to it.",
      },
      {
        title: "Late-season heat that models smooth away",
        body: "A late warm spell is exactly the signal a smoothed ensemble flattens. Matching on both strength and timing keeps years that peaked at the right moment for the right reason, and discards years that only look similar.",
      },
      {
        title: "Checking the answer instead of trusting it",
        body: "Measured history is always shown in full alongside the projection. You can see how well the method tracked the days that already happened before deciding what to do with the days that have not.",
      },
    ],
    limits: [
      "This forecasts a temperature peak within a window. It is not a severe-weather warning service and must not be used as one.",
      "The engine coefficients are proprietary and are never returned by any interface — the method is published, the numbers are not.",
    ],
  },

  "tremor-map-engine": {
    hook: "Put ground movement and presence readings on a map you can actually read in the field.",
    pitch: [
      "Readings on their own are a column of numbers. On a map, in place, over time, they become a picture you can act on — where movement is concentrated, where it is spreading, and where nothing is happening at all.",
      "It runs as its own site with its own deployment, so it stays up whether or not the rest of the stack is running, and it reads cleanly on a phone screen in daylight rather than only on a desk monitor.",
      "It observes and displays. It never infers a person, a handset or a carrier path from a reading — that boundary is written into the provenance record and enforced in the product.",
    ],
    specs: [
      { label: "Runs as", value: "Its own published site, separate deployment" },
      { label: "Display", value: "Map surface with reading overlays, readable on a phone in daylight" },
      { label: "Data", value: "Ground movement and presence readings over time" },
      { label: "Boundary", value: "Observation only — no identification of people, handsets or carrier paths" },
      { label: "Pairs with", value: "Tremor presence firmware in the Apex Flash Kit" },
      { label: "Licence", value: "Same account as everything else; included in the full stack" },
    ],
    useCases: [
      {
        title: "Watching a site over days",
        body: "Movement that means nothing in a single reading becomes obvious as a pattern once it is placed and stacked over time.",
      },
      {
        title: "Placing your own sensors",
        body: "Paired with the presence firmware from the flash kit, your own hardware feeds the same map instead of a vendor's cloud.",
      },
      {
        title: "Showing somebody else what you found",
        body: "A map is the one form of this data a non-specialist can read without a briefing.",
      },
    ],
    limits: [
      "It is a mapping and observation surface, not an early-warning or life-safety system.",
    ],
  },

  "apex-miner": {
    hook: "A twenty-dollar display board that mines the Bitcoin lottery on one core and watches your Wi-Fi with the other.",
    pitch: [
      "The ESP32 Cheap Yellow Display is cheap because it is mass produced, not because it is weak. This firmware gives it two jobs at once: it takes lottery shares at solo odds, and it listens to the air around it for the thing that actually costs people money — an access point pretending to be one you trust.",
      "The mining half is honest about what it is. Solo lottery mining is a ticket, not an income; the board's own hash rate will not pay your power bill. What it will do is keep a live, sealed record of every share it takes, on a screen you can look at from across the room.",
      "The defence half is the part that earns its place on a shelf. It watches for a second access point broadcasting a name it has already seen from a different radio, flags it on screen, and writes the event into a sealed log you can read later — no cloud account, no subscription, nothing leaving the board.",
    ],
    specs: [
      { label: "Hardware", value: "ESP32 Cheap Yellow Display (ESP32-2432S028R class board)" },
      { label: "Flashing", value: "From the browser with the Apex Flash Kit — no toolchain to install" },
      { label: "Mining", value: "Bitcoin solo lottery shares with live on-screen status" },
      { label: "Defence", value: "Passive Wi-Fi watch with evil-twin (duplicate SSID) detection" },
      { label: "Record", value: "Sealed local event log — hash-linked, readable on device" },
      { label: "Network", value: "Runs standalone; no vendor cloud and no account required" },
      { label: "Status", value: "In development — listed, not sold, until the build is finished and signed" },
    ],
    useCases: [
      {
        title: "A lottery ticket that does something useful while it waits",
        body: "The odds of a solo block are what they are. In the meantime the same board is doing real work watching the network it sits on.",
      },
      {
        title: "Catching a fake access point",
        body: "Evil-twin attacks work because nobody is watching for a duplicate name. This board watches continuously and says so on its own screen.",
      },
      {
        title: "A node you own outright",
        body: "It is your hardware, your firmware and your log file. Nothing is reported to anyone, and it keeps working with the internet down.",
      },
    ],
    limits: [
      "Solo lottery mining is not income. Expect no return; treat any result as a windfall.",
      "The Wi-Fi watch is passive observation of broadcast beacons. It does not crack, inject, deauthenticate or identify individual people.",
      "The build is not finished. It is listed as in development and is not on sale until the firmware is complete and the image is checksummed.",
    ],
  },

  "michigan-money-saver": {
    hook: "The local garage-sale board, running on the shielded stack instead of on somebody's advertising network.",
    pitch: [
      "Buying and selling second-hand locally still mostly happens on platforms that treat both sides as inventory: your listing feeds their advertising, your messages feed their profile of you, and the rules change whenever it suits them. This is the same simple thing — a neighbour's listing, a photo, a price, a place — with none of that attached.",
      "Listings and search sit on the shielded account stack, and messages between buyer and seller run over the same on-device signed channel the rest of the line-up uses. The people talking are the only ones who can read it, and there is no advertising model underneath asking for more.",
      "It is deliberately local and deliberately small. A board for a county, not a marketplace for a continent.",
    ],
    specs: [
      { label: "Runs on", value: "Any modern browser — phone, tablet or desktop" },
      { label: "Listings", value: "Photo, price, description and place, posted by the seller" },
      { label: "Finding things", value: "Search plus a map view of what is near you" },
      { label: "Messaging", value: "Apex network chat — signed on the device before it leaves" },
      { label: "Accounts", value: "Shielded accounts on the same login as the rest of the line-up" },
      { label: "Business model", value: "No advertising, no data resale, no commission on your sale" },
      { label: "Status", value: "In development — listed, not sold, until the marketplace is finished" },
    ],
    useCases: [
      {
        title: "Clearing out a garage",
        body: "Post what you have with a photo and a price, and let people nearby find it without joining anything that sells their attention.",
      },
      {
        title: "Looking for something specific nearby",
        body: "Search and a map, scoped to your own area, instead of a national feed full of things you cannot collect.",
      },
      {
        title: "Arranging the handover privately",
        body: "Messages between buyer and seller are signed on the device, so the arrangement stays between the two of you.",
      },
    ],
    limits: [
      "It is a listings board. It does not take the payment, hold the money, verify a buyer or a seller, or guarantee any transaction.",
      "Meeting a stranger to trade carries the same risks it always has. Use sense: daylight, a public place, someone with you.",
      "The build is not finished and is not on sale yet.",
    ],
  },
};

export function productDetail(slug: string): ProductDetail | undefined {
  return PRODUCT_DETAIL[slug];
}

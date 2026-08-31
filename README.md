# Solo Leveling

A two-player, 90-day pact tracker built as a Solo Leveling system window. Quests, a
shared 90-day grid, System alerts that actually buzz your phone, gym and fuel logs,
XP/level/rank progression, and an AI Architect that reads your real numbers.

Everything is stored in the browser on the device it runs on. There is no server.

---

## Sign in

Two accounts are created the first time the app loads:

| Hunter    | Username | Password   |
| --------- | -------- | ---------- |
| Player 1  | `mohith` | `shadow90` |
| Player 2  | `hunter` | `arise90`  |

Change both from **Settings → Account** (username, password and grid accent colour).
Change the display names from **Settings → Profile**.

Passwords are salted and hashed with PBKDF2-SHA256 before they are stored. That keeps
you two out of each other's HUD; it is **not** encryption, and anyone holding this
unlocked device can read the stored data from devtools.

A session lasts 120 days with "stay signed in" ticked, so neither of you gets logged
out mid-pact.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000, also served on your LAN IP
```

Other scripts: `npm run build`, `npm run preview`, `npm run lint` (typecheck).

For the AI features, copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`.
Everything else works without a key.

## The 90-day pact

The **90 DAY PACT** tab is the centre of the app. Both hunters get their own 90-cell
grid, side by side:

- A day turns your accent colour when **every** daily quest is cleared.
- A partly-done day is faded; a missed day is red.
- The **BOTH CLEARED** counter only moves on days you both cleared.
- Streaks are derived from that grid, so they cannot drift out of sync with it.

Start date, length and name are editable — press **EDIT PACT**.

Daily quests reset at local midnight and weekly raids reset on Monday. The previous
day is frozen into the grid before the ticks are wiped, whether or not the app was
open when the day turned.

## Alerts

**ALERTS** is where reminders live. Each one has a time, an optional repeat window, the
days it is armed on, and an optional link to a quest — a linked alert goes quiet as
soon as that quest is cleared.

Seven presets are armed on first sign-in: hydration every 2h from 08:00–22:00, a
morning system check, protein at 13:00 and 20:00, gym at 18:00 Mon–Sat, a 21:30 quest
sweep, a 22:00 pact check-in with your partner, and a 23:00 sleep protocol. Delete or
rewrite any of them; **PRESETS** re-arms whichever ones are missing.

Alerts marked **count it** show a daily tally (water reads `5 / 8`) with a **LOG IT**
button on the notification toast.

You can also attach an alert to a single quest without leaving the **TASKS** tab: set a
time in the add-quest form, or tap the bell on any quest card.

**How delivery works.** Alerts fire while the browser is running with the HUD open in a
tab — via a service worker, so a backgrounded tab still buzzes. Press **ARM ALERTS** on
the Alerts tab to grant permission. Push notifications with the browser fully closed
would need a server holding VAPID keys, which this app deliberately does not have.

On a phone, install it to the home screen (Share → Add to Home Screen, or Chrome's
install prompt) — alerts behave far better as an installed app than as a browser tab.

## The AI Architect

The **COACH** tab streams replies from Gemini in the System's voice, with your real
state in context: pact day, streak, open quest names, today's calories and training
volume, and how your partner is doing. It is a conversation, not a single button —
type, or tap one of the prompt chips.

Once a day, in the background, the Architect also rewrites the copy for your armed
alerts. Alerts never wait on it: they render instantly from the local phrase bank and
pick up the AI lines on a later fire.

## Two devices

Each device keeps its own save. Both grids are live on whichever device you both use;
on separate phones, each of you only sees your own.

**Settings → Backup** exports the whole save as JSON and imports it on the other
device. Importing overwrites both hunters' progress on the receiving device.

## Layout

```
src/
  lib/
    alerts.ts       reminder scheduling maths (pure — no DOM, no storage)
    auth.ts         accounts, sessions, seeding, legacy migration
    crypto.ts       PBKDF2-SHA256, with a JS fallback for plain-HTTP LAN access
    storage.ts      namespaced + memoised localStorage
    time.ts         local-time day keys, ISO weeks, HH:MM parsing
    context.ts      the pact snapshot the AI and the alert engine share
    phrases.ts      the System's offline voice
  hooks/
    useAlertEngine  the runtime that fires alerts and drives the toasts
  services/
    gemini.ts       the model SDK — loaded on demand, never in the first paint
  store.ts          per-player records, rollover, streaks, the pact grid
```

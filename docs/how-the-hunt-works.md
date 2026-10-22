# How the hunt works

Context for anyone working on the site or the scoring sheet. The scoring itself is done in Google Sheets; this site only displays the result.

## Structure

- There are **4 clues** and a **final location**.
- Teams are split into two directions by team number (odd = Vampires, even = Zombies), set in the registration sheet's **WhatsApp Groups** tab:
  - **Vampires:** Clue 1 → 2 → 3 → 4 → final location
  - **Zombies:** Clue 3 → 2 → 1 → 4 → final location

  Clue 4 leads every team to the final location.
- At each clue, teams **check in** when they arrive and **check out** when they leave, using that clue's Google Form ("Fall 2026 Scavenger Hunt Clue #1" through "#4"). This tells organizers where every team is.
- Each form writes to its own responses sheet (e.g. "Fall 2026 Scavenger Hunt Clue #2 (Responses)"); the leaderboard sheet's **Form Data** tab merges all four. Each clue's block in Form Data has the same six columns (timestamp, team name, team number, check-in/out, mode, bonus minutes), matched to the form's questions by name, so the forms can ask their questions in any order. The mode column takes the check-out answer ("…mode did you finish…") and falls back to the check-in answer ("…mode are you participating…"); the bonus column takes the first question with "bonus" in its name. Bonuses by clue (amounts are settings in Calculations):
  - **Clue 1:** "Did you receive a bonus?"; any answer starting with "Y" is worth **30 minutes** (E4).
  - **Clue 3:** "Bonus photo!" upload; any uploaded photo is worth **10 minutes** (E5).
  - **Clues 2 and 4:** the team enters minutes in "Bonus time earned (in minutes)", if the form asks.
- At the final location, teams submit the **finish form** (the sheet's **Finish Data** tab), which stops their clock.
- When teams arrive, they fill in the **start check-in form** (the sheet's **Check-In Data** tab), which records their wave.
- The leaderboard sheet's **Teams** tab is filled by a formula, never by hand: team #, name, and direction come from the registration sheet's WhatsApp Groups tab (via `IMPORTRANGE`), and wave is the one each team picked on its latest start check-in. Everything else (Calculations, Photo Leaderboard, the worker) reads Teams. To change a team's name or direction, edit WhatsApp Groups; to fix a wave, resubmit the check-in form. Formulas that read Check-In Data must use whole columns (`'Check-In Data'!B:B`), because Google Forms inserts a row for each response and shifts ranges like `B2:B`.
- Teams set off in **waves**. Waves aren't scheduled in advance: organizers send a group off and record the time it left in the **Calculations** tab, and each team's clock starts from its wave's time.

Each form response records: timestamp, team name, team number, check-in or check-out, mode (Chill/Competitive), and bonus time earned in minutes.

## Chill vs. Competitive mode

- Teams play each clue in **Chill** or **Competitive** mode.
- **Chill mode adds 30 minutes** to a team's time for that clue. Competitive mode adds nothing.
- A team can switch from Competitive to Chill partway through a clue, so **the mode at check-out is the one that counts** for that clue.

Each clue form asks for the mode at **both** check-in (so teams commit to a choice) and check-out. The scoring sheet should use the check-out answer, falling back to the check-in answer if check-out is blank.

> **Form setup:** section 1 asks "Are you checking-in or checking-out?" (required) and routes Check-In to the Check-In section and Check-Out to the Check-Out section. **After the Check-In section, the form must go to Submit**, or check-ins fall through into the Check-Out questions. Keep the question names: Form Data finds "Timestamp", "Team Name", "Team Number", "…checking-in or checking-out…", "…mode did you finish…", "…mode are you participating…" and "…bonus…" by name. The mode answers must be exactly **Chill** or **Competitive**; anything else gets no mode adjustment.

## Live tracker

The site's Tracker tab shows where every team is, computed by the worker (`worker/tracker.js`) from the Teams, Check-In Data, Form Data, and Finish Data tabs. Teams are matched by **team number**; display names come from the Teams tab, so typos in the forms' Team Name field don't matter.

| Latest event | Shown as |
|---|---|
| None yet | Not shown |
| Start check-in form (the **Check-In Data** tab) | At the start, with their check-in time |
| Checked in at a clue | At that clue |
| Checked out of a clue | On the way to the next clue on their route (or the final location after Clue 4) |
| Finish form | At the final location |

Stops are labeled **Stop 1–4 in each direction's own order** (so for Zombies, Clue 3 is Stop 1), never by clue number or name, so the tracker doesn't reveal where teams are headed. The Direction column can say Vampire or Vampires (any capitalization), and likewise Zombie or Zombies; teams with anything else aren't shown. A team number in the forms that isn't in the Teams tab is ignored.

## Photo challenge

Teams submit photos through the photo challenge form, which saves uploads to the "Scav Hunt Photo Challenge (File responses)" Drive folder and writes a row (with Drive links) to the leaderboard sheet's **Photo Data** tab.

The site's **Photos** tab has two views:

- **Feed:** the newest photos (up to 300), like a social media feed, loaded as you scroll. Built by the worker (`worker/photos.js`) from Photo Data and the Teams tab, named by team number. Picked up automatically if present: a column whose header contains "bird" (shown as "🐦 3 birds"), and a **Hide** column judges can set to TRUE/yes/x to pull a photo from the feed.
- **Standings:** the **Photo Leaderboard** tab, minus organizer-only columns (team #, photos removed by judge, photo bonus flag, wave, last submission).

Photos are never linked from Drive directly. The worker serves a resized preview (about 720px, ~50–110 KB vs. 2–4.5 MB originals) at `/photo/<token>`, where the token is the file ID and an expiry encrypted with the `PHOTO_SIGNING_SECRET` worker secret. Only visitors past the password get tokens, they expire after 2–3 hours, and they don't reveal the file ID. The service account needs **Viewer** access to the uploads folder, and the Google Cloud project needs the **Drive API** enabled.

## Rules tab

A quick reference for teams during the hunt (they only get the site on hunt day): waves and directions, checking in and out, chill vs. competitive, bonuses (some stops have bonus challenges, and the photo challenge winner gets 30 minutes off; neither is described), finishing, scoring, and an "Open WhatsApp" help button. It never names clues or locations. The WhatsApp button uses `whatsapp://send?text=%20`; other links that failed on Android Chrome are listed in a comment in `src/Rules.js`.

## Scoring

The leaderboard comes from the `leaderboard_external` tab of the "Fall 2026 Hunt Leaderboard" sheet, which the worker reads (see `SHEET_RANGE` in `worker/wrangler.toml`). Columns:

| Column | Meaning |
|---|---|
| Rank | Position on the leaderboard |
| Name | Team name |
| Total Adjusted Time | Total Time + 30 min per Chill clue − bonus minutes, in decimal minutes (e.g. `373.7`) |
| Total Time | Actual time spent, as `H:MM:SS` |
| # of Clues Done | Clues completed |
| Wave | Which start wave the team was in |

The site shows both time columns as hours and minutes, rounded to the nearest minute.

**Inferred from the data, not yet confirmed:**

- Ranking is by most clues done, then lowest adjusted time.
- Bonus minutes are subtracted from adjusted time.

Like the tracker, the leaderboard only lists teams that have checked in at the start (or have any clue or finish activity), so no-shows never appear; before the hunt it's empty and the site says "No scores yet".

The site highlights the leader (👑) rather than a top 3.

## Hosting limits

The worker runs on Cloudflare's **free plan**, which allows **10 ms of CPU per request**. Most requests use well under 1 ms. The heaviest is a fresh worker instance's first request, which encrypts every photo's link (about 21 µs each), which is why the feed is capped at 300 photos (`MAX_PHOTOS` in `worker/photos.js`). On the paid plan ($5/month) the cap can go to 1000+.

## Hunt-day checklist

Before the hunt:

- [ ] Clear the test-run responses from the photo form. The four clue forms' and the finish form's response sheets were cleared on Oct 21; clear them again after any test submissions. Delete rows in the forms' own "(Responses)" sheets: the leaderboard sheet's Form Data and Finish Data tabs are imports and can't be edited. (Check-In Data is the start form's own responses tab, so delete its test rows there directly.)
- [ ] Clue forms: after the Check-In section, each form goes to Submit (mode is now asked at check-in and check-out on all four).
- [ ] Photo form: add the bird count question; remove the test run's "Which AI companies…" question.
- [ ] Photo Leaderboard: add bird totals and rank by them.
- [ ] WhatsApp Groups tab (registration sheet): every team has a team #, name, and direction. The Teams tab picks them up automatically.
- [ ] Clear the test rows from the start check-in form (Check-In Data).
- [ ] Decide when the photo leader bonus kicks in (Calculations "Photo bonus kicks in"). The Rules tab says the photo challenge winner gets 30 minutes off, without describing the challenge, so teams can't start early.
- [ ] Sharing: set the photo uploads folder (currently "anyone with the link can edit") and the leaderboard sheet (currently "anyone with the link can view") to Restricted. The service account and organizers keep their own access.
- [ ] Optional: add a Hide column to Photo Data for judges.

Testing:

- [ ] The Rules tab's WhatsApp button on an iPhone in Safari (only tested on Android Chrome).
- [ ] Photos → Feed on the live site, on a phone.
- [ ] Dress rehearsal: submit a check-in, check-out, photo, and finish on the live forms; the Tracker, Feed, and Leaderboard should update within about a minute.

On the day:

- [ ] Have each team fill in the start check-in form as it arrives; its wave shows up in the Teams tab.
- [ ] Record each wave's start time in the Calculations tab as it leaves.

## Open questions

- How is the photo leader bonus earned, and from when?

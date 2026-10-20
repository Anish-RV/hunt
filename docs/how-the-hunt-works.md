# How the hunt works

Context for anyone working on the site or the scoring sheet. The scoring itself is done in Google Sheets; this site only displays the result.

## Structure

- There are **4 clues** and a **final location**.
- Teams are split into two directions, pre-assigned in the **Direction** column of the Teams tab:
  - **Vampires:** Clue 1 → 2 → 3 → 4 → final location
  - **Zombies:** Clue 3 → 2 → 1 → 4 → final location

  Clue 4 leads every team to the final location.
- At each clue, teams **check in** when they arrive and **check out** when they leave, using that clue's Google Form ("Fall 2026 Scavenger Hunt Clue #1" through "#4"). This tells organizers where every team is.
- Each form writes to its own responses sheet (e.g. "Fall 2026 Scavenger Hunt Clue #2 (Responses)").

Each form response records: timestamp, team name, team number, check-in or check-out, mode (Chill/Competitive), and bonus time earned in minutes.

## Chill vs. Competitive mode

- Teams play each clue in **Chill** or **Competitive** mode.
- **Chill mode adds 30 minutes** to a team's time for that clue. Competitive mode adds nothing.
- A team can switch from Competitive to Chill partway through a clue, so **the mode at check-out is the one that counts** for that clue.

Each clue form asks for the mode at **both** check-in (so teams commit to a choice) and check-out. The scoring sheet should use the check-out answer, falling back to the check-in answer if check-out is blank.

> **Form setup:** section 1 asks "Are you checking-in or checking-out?" (required) and routes Check-In to the Check-In section and Check-Out to the Check-Out section. **After the Check-In section, the form must go to Submit**, or check-ins fall through into the Check-Out questions. Don't rename the questions; the sheet's Form Data and Calculations tabs depend on them.

## Live tracker

The site's Tracker tab shows where every team is, computed by the worker (`worker/tracker.js`) from the Teams, Form Data, and Finish Data tabs. Teams are matched by **team number**; display names come from the Teams tab, so typos in the forms' Team Name field don't matter.

| Latest event | Shown as |
|---|---|
| None yet | At the start |
| Checked in at a clue | At that clue |
| Checked out of a clue | On the way to the next clue on their route (or the final location after Clue 4) |
| Finish form | At the final location |

Teams without a Vampires/Zombies direction appear under "No direction yet". A team number in the forms that isn't in the Teams tab is ignored.

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

Only first place wins a prize, so the site highlights the leader and not a top 3.

## Open questions

- How does the final location factor in: is it a check-in only, and does it stop the clock?
- How are bonus minutes earned?
- Will there be a separate leaderboard per direction?

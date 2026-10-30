# The Family Archive

A private, family-only website for our old photos and home videos. Runs in its own container on the Proxmox server.

## What's built (foundation)

- **Invite-only accounts**: the first visitor creates the owner account (`/setup`). The owner makes one-time invite links on `/family`.
- **The look**: a 90s home video, grown up — ivory paper by day, late-night TV by night, burgundy/green/gold, late-90s Georgia + Verdana with typewriter Courier for labels (Linux/Android get the free lookalikes Gelasio and DejaVu Sans), and small camcorder touches (orange `'94 12 25` date stamps, `PLAY ▶`, scan lines, "Be kind, rewind"). **Dark mode** follows the phone/computer and has a ☾/☀ button that's remembered per device. All colours live as CSS variables at the top of `src/routes/layout.css`.
- **Home page**: a "TV" playing a random memory, the headline and stats (photos, videos, tapes, Christmases), **▶ Play a memory** (jumps to a random home video or scene on tape), then the timeline: one row per year with a strip of photos and tape scenes, decade jumps, the tape shelf, occasions, the mystery box and an optional dedication.
- **Front page words**: the family name, headline, intro and dedication are edited on the Family page (no restart needed).
- **Occasions**: Christmas, Birthdays, Easter… each gets its own page, grouped by year ("Christmas 1986, Christmas 1987…").
- **Mystery box**: anything with no date, so family can help figure it out.
- **Photo/video viewer**: arrow keys to flip through a year, download the original, delete (owner or whoever added it).
- **Edit details**: anyone in the family can fix the date, occasion, title or add the story behind a photo. Undated photos open with "Do you know when this was?" and a *Save, then the next mystery* button, so the mystery box can be emptied one after another. Shows who last changed the details.
- **Sample photos**: on the Family page, the owner can add ~80 sample photos and videos plus three sample tapes (real photos from picsum.photos, aged to look like old prints) to try the site out, and remove them all with one click. Samples are marked in the database, so removing them never touches real uploads.
- **Tape shelf** (`/tapes`): every tape drawn as an 8mm cassette, with its label, years and length — including tapes that aren't digitized yet, so you can see how far along you are. A tape's page plays the recording next to a list of what's on it (one line per thing written on the label, with dates and occasions); tap a line to jump there. Scans of the cassette sticker and the box are shown as they were written, and the sticker scan becomes the cassette's label on the shelf. The edit page has the video beside the list so you can play the tape and press **⏱ now** where each scene starts. Typing “Xmas '88 at Nana's” fills in the year and occasion by itself. Dated scenes show up on the timeline and on their year's page under **On tape**, with a picture taken from the tape.
- **Uploads** (`/upload`): drag and drop or pick from a phone. Set the date (just a year is fine) and occasion once for the batch. Files go up in 32 MB pieces, so big videos work through Cloudflare Tunnel and a dropped connection continues where it stopped. ffmpeg then makes the thumbnail, the large photo and a web MP4 (deinterlaced, square pixels, max 1080p), one file at a time. **Digitized tapes**: upload the raw OBS capture as-is — the capture card's blue "no signal" screen (or black) at the start and end is cut down to 3 seconds (for that putting-the-tape-in feel), and tape-sized (SD) videos get a light noise clean-up, which is what makes a 15 GB capture come out around 1–2 GB. Once the web copy is ready, the raw capture is deleted (any SD video over 1 GB) to save space on the NAS; Download then gives the web copy.
- **Going through a tape**: when a video longer than 10 minutes is processed, a third step finds where the camera was stopped and started (a one-frame jump in the picture, even a small one; a pan or someone walking past changes it over many frames, so it isn't counted). On **Edit tape** the recording is shown as a list of stretches between those cuts: ▶ plays just that stretch, **Keep** saves it as a scene with its start and end (type a name or pick a line from the label; Enter keeps it), **Join with next** when the next stretch is still the same memory, **Skip** for blank tape or mistakes (remembered), and **✂ Cut here** while playing when a camera stop was missed. Older tapes get **Find the scenes**, and any tape can be looked through again.
- **Scenes as clips** (`/tapes/<id>/scene/<sec>`): every scene with a start time has its own page that plays just that scene, stops at its end and offers **Next** or **↺ Again**, plus **⬇ Save this scene as a video**, **Watch the whole tape from here** and **← Before / After →**. Scenes show on the year and occasion pages, the timeline and "Play a memory". Every scene has its own start and end; one typed in with only a start gets the next scene's start as its end when saved.
- **People** (`/people`): anyone can tag who's in a photo, video or scene (**Who's in this?**), or tag a whole upload batch at once. Each person has a page with their scenes and photos in date order. The owner can rename, merge ("Nana" = "Grandma Rose") or remove a person; removing only takes the tags off.
- **Storage** (`/family/storage`, owner): what's using the disk, and a **Re-make** button per video to make the web copy again from the original (when the original is still there). Processing shows its step and percentage on the tape, upload and storage pages. If a re-made tape is trimmed differently, its scene times move with it. Re-made videos get new addresses so browsers don't keep the old one.
- Dates can be fuzzy: `1987`, `1987-12` or `1987-12-25`, because old photos rarely have an exact date.

## Project tree

```
FamilyWeb/
├── deploy/
│   ├── proxmox-host.sh          Proxmox helper script: creates the container, installs/updates
│   └── install.sh               runs in the container: Node.js, ffmpeg, systemd service
├── design/mockups/              the design mock-ups (open in a browser), for trying ideas before building them
├── server.js                    starts the built site (works over http at home and https via a tunnel)
├── compose.yaml, Dockerfile     alternative: run it with Docker instead
├── .env.example                 settings for the Docker way
└── src/
    ├── hooks.server.ts          locks every page behind login
    ├── lib/
    │   ├── occasions.ts         ← edit this to change the occasion list/colours
    │   ├── format.ts            dates, durations, the '94 12 25 date stamp
    │   ├── dates.ts             fuzzy dates: checking and building them
    │   ├── filetypes.ts         which photo/video formats are accepted
    │   ├── tapes.ts             tape times, reading “Xmas '88” from a label line, label colours
    │   ├── components/          Cassette (the drawn tape), MediaGrid, SceneGrid, People, EditDetails, DateFields, ThemeToggle, AuthCard, SignupFields
    │   └── server/
    │       ├── schema.sql       the database tables
    │       ├── db.ts            SQLite (built into Node, no extra service) + migrations
    │       ├── auth.ts          passwords, sessions, invites
    │       ├── media.ts         timeline / year / occasion queries
    │       ├── tapes.ts         tapes, scenes, label scans, stills from tapes
    │       ├── people.ts        who's in what: tags, people pages, rename/merge
    │       ├── settings.ts      the front page words (family name, headline, dedication)
    │       ├── process.ts       ffmpeg: thumbnails, web videos, camera dates, the queue
    │       └── demo.ts          sample photos/videos (add / remove)
    └── routes/
        ├── layout.css           ← the look: colours (light + dark), fonts, date stamps
        ├── +page.svelte         home: hero + timeline + tapes + occasions
        ├── random/              "Play a memory"
        ├── year/[year]/         one year
        ├── occasion/[slug]/     one occasion across all years
        ├── undated/             the mystery box
        ├── m/[id]/              single photo/video viewer
        ├── tapes/               the tape shelf; [id]/ watch a tape, [id]/edit/ labels + scenes, [id]/scene/[sec]/ one scene as a clip
        ├── people/              everyone tagged; [id]/ one person's collection
        ├── api/people/          the list of names, adding names, tagging
        ├── upload/              drag-and-drop upload page
        ├── api/upload/[token]/  receives upload chunks, then files them
        ├── api/status/          "is it ready yet?" for the upload page
        ├── files/[id]/[file]/   serves the media (logged-in only, video seeking works)
        ├── family/              invite people, members, front page words, samples (owner only); storage/ disk use + Re-make
        └── setup/ login/ invite/[code]/ logout/
```

Media on disk: `DATA_DIR/media/<id>/original.*`, `thumb.webp` (480px short side), `large.webp` (2048px), `video.mp4` (videos). Tapes: `DATA_DIR/tapes/<id>/` holds the label scans (original + `sticker.webp`/`sleeve.webp`) and `frames/` (scene pictures, made on first view). Unfinished uploads wait in `DATA_DIR/uploads/` and are cleaned up after 3 days.

Needs `ffmpeg`/`ffprobe` on the PATH (the installer and the Docker image include them).

Database changes go in the `MIGRATIONS` list in `src/lib/server/db.ts` (append only), so updating a server that's been running for years just works.

## Run it

```bash
pnpm install
DATA_DIR=./data FAMILY_NAME=Smith pnpm dev     # http://localhost:5173 (no upload size limit in dev)
```

## Put it on the Proxmox server

The code lives on GitHub (`irregulur/FamilyWeb`, public — code only, never photos). Every push builds a release automatically (`.github/workflows/release.yml`).

In the Proxmox web page: click your server → **Shell**, and paste:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/irregulur/FamilyWeb/master/deploy/proxmox-host.sh)"
```

The first time, menus (like the community helper scripts) ask for the family name, which storage the container goes on (e.g. `local-lvm`), where the photos and videos go (your NAS shares from Datacenter → Storage are listed, or type a folder, or keep them inside the container) and the network bridge. The container is Debian, up to 4 cores, 2 GB memory, starts at boot. With a NAS folder the container itself is only 16 GB; the script checks the site can write to that folder (it runs as user 101990 on the Proxmox host).

At the end it prints the address, e.g. `http://192.168.1.60`. Open it, create your account (you become the owner), and invite the family from the Family page.

**Updating**: push the changes to GitHub, wait for the release to finish (GitHub → Actions), then either paste the same line in the Proxmox Shell again, or type `update` in the container's Console. Only the program is replaced; photos, videos and accounts stay. A copy of the database is saved in `backups/` first (last 10 kept), and if the new version doesn't start it goes back to the old one.

**Settings** live in `/etc/familyweb.env` inside the container (Proxmox → the container → Console): `nano /etc/familyweb.env`, then `systemctl restart familyweb`. Logs: `journalctl -u familyweb`.

**From outside the house**: add a Cloudflare Tunnel (or Tailscale) pointing at `http://<container-ip>:80`. Nothing else to change: the site works over plain http at home and over https through the tunnel.

**Backups**: Proxmox → Datacenter → Backup → add a job for the `familyweb` container. If the photos are in a host folder instead, back up that folder on the NAS.

<details><summary>Alternative: Docker</summary>

```bash
cp .env.example .env    # set FAMILY_NAME
docker compose up -d --build
```
</details>

## Roadmap

1. ~~**Uploads**~~ ✓
2. ~~**Easy Proxmox install**~~ ✓
3. ~~**Edit details**~~ ✓
4. ~~**Tape import**~~ ✓: captures are shrunk on upload, scenes are suggested, and each scene plays as a clip.
5. ~~**People**~~ ✓

### Next up (in this order)

1. **Backups of the photos and videos.** Today only the database is copied, and only before an update. If the disk dies, the digitized tapes go with it, and redoing them means finding the tapes and the VCR again. Plan: a nightly copy of `DATA_DIR/media` and `DATA_DIR/tapes` to the NAS (or rclone to cloud storage), and a "last backup" line on the Family page so it's obvious when it stops working.
2. **Search.** One box in the menu that finds titles, descriptions, scene names and people ("beach", "Nana"). SQLite's built-in full-text search (FTS5) does it with no new dependencies.
3. **Stories and comments.** Family write what was happening under a photo or scene. Right now only one description per item exists, and the stories are often worth more than the pictures.
4. **On This Day.** A strip on the home page with photos and scenes from today's date in past years. No new data needed, only a query on the dates already there.

### Later

- **Favourites** (♥) and a "Best of" page.
- **Albums**: hand-picked collections ("Mum's 60th slideshow") for things that aren't one year, occasion or person.
- **TV mode**: full-screen automatic slideshow for a year, occasion or person, for the living room at a family gathering.
- **Share link**: a private, expiring link to one scene or album for a relative without an account.

### Decided against (for now)

- **Face recognition**: heavy and unreliable on VHS-quality video; hand tagging is enough for one family.
- **Map**: old tapes and scanned photos have no GPS.

## Ideas

**Browsing**
- **On This Day**: the home page shows what happened on today's date in past years.
- **Then & Now**: drag a slider between an old photo and the same place or pose today.

**Family taking part**
- **Comments and stories**: Grandma writes what was happening when a photo was taken. These are often worth more than the photo.
- **Voice notes**: record a 30-second memory on your phone and attach it to a photo, for relatives who'd rather talk than type.
- **"Who is this?"**: flag a face you don't recognise and let the family answer.
- **Favourites** (♥), plus a "most loved" row.

**Christmas day**
- **TV mode**: a full-screen slideshow with music for the living room TV, filtered by year or by "Christmas only".
- **Year in review**: a short reel of each year's highlights.
- **The reveal**: a countdown landing page that opens on Christmas morning.

**Tapes**
- ~~**Chapters**~~ and ~~**Tape labels**~~: built, see Tape shelf above.
- ~~**Scenes on the occasion pages**~~: built.

**Games and gifts**
- **Guess the Year**: a photo appears on the TV, everyone guesses the year on their phone, closest wins. Good for Christmas dinner.
- **Printed calendar**: a print-ready PDF for next year, each month showing a photo from that month in a past year. Makes a good present for the grandparents.
- **QR codes for prints**: print a photo or Christmas card with a QR code that opens the matching home video.
- **Time capsule**: write a letter or record a video that unlocks on a chosen date, such as a kid's 18th birthday.

**Small touches**
- **"How old was everyone?"**: once people have birthdays, captions show ages: "Mom, 7 · Grandpa, 41".
- **This week in 1989**: a weekly email with a few old photos, for relatives who'll never log in.
- **Grandparent mode**: bigger text and buttons, and only Back and Next.
- **Recipe box**: scans of handwritten family recipes, linked to the holiday photos where the dishes were served.
- **Duplicate finder**: catches the same scan uploaded by three cousins.
- **Song of the year**: each year's page shows that year's #1 song.

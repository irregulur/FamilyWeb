#!/usr/bin/env bash
# Installs or updates the site on a Debian 12/13 machine (the Proxmox container, a VM, a Pi…).
# Run as root from an unpacked release: bash deploy/install.sh
# Safe to run again: it only replaces the program, never the photos or the database.
# It also adds an `update` command that installs the newest release from GitHub.
set -euo pipefail

APP=/opt/familyweb
REPO=${FAMILYWEB_REPO:-irregulur/FamilyWeb}
DATA=${DATA_DIR:-/var/lib/familyweb}
ENV_FILE=/etc/familyweb.env
HERE=$(cd "$(dirname "$0")/.." && pwd)
export DEBIAN_FRONTEND=noninteractive
export LANG=C.UTF-8 LC_ALL=C.UTF-8 # Debian containers only have this one; avoids pages of locale warnings
say() { printf '\033[1;33m→ %s\033[0m\n' "$*"; }

[ "$(id -u)" = 0 ] || { echo "Please run as root."; exit 1; }
[ -f "$HERE/build/handler.js" ] || { echo "No build/ folder next to this script — run it from an unpacked release."; exit 1; }

# --- Programs: Node.js 24 and ffmpeg ---------------------------------------------------------
if ! node --version 2>/dev/null | grep -q '^v24\.'; then
	say "Installing Node.js 24"
	apt-get update -qq
	apt-get install -y -qq ca-certificates curl gnupg >/dev/null
	curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null
	apt-get install -y -qq nodejs >/dev/null
fi
if ! command -v ffmpeg >/dev/null; then
	say "Installing ffmpeg (makes thumbnails and web videos)"
	apt-get update -qq
	apt-get install -y -qq ffmpeg curl >/dev/null
fi

# --- A user for the site, so it doesn't run as root ------------------------------------------
# Fixed id 1990 so a folder shared from the Proxmox host can be given to it (seen there as 101990).
if ! id familyweb >/dev/null 2>&1; then
	if getent passwd 1990 >/dev/null || getent group 1990 >/dev/null; then
		useradd --system --user-group --home-dir "$DATA" --shell /usr/sbin/nologin familyweb
	else
		groupadd --system --gid 1990 familyweb
		useradd --system --uid 1990 --gid 1990 --home-dir "$DATA" --shell /usr/sbin/nologin familyweb
	fi
fi
mkdir -p "$DATA"
chown familyweb:familyweb "$DATA" || echo "Warning: couldn't give $DATA to the familyweb user; uploads may fail."

# --- Settings (only written the first time) --------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
	say "Writing settings to $ENV_FILE"
	cat >"$ENV_FILE" <<EOF
# Settings for the family archive. After changing: systemctl restart familyweb
FAMILY_NAME=${FAMILY_NAME:-Our Family}
DATA_DIR=$DATA
PORT=80
# Uploads arrive in 32 MB pieces
BODY_SIZE_LIMIT=64M
NODE_ENV=production
EOF
fi

# --- Safety copy of the database (accounts, dates, titles, tapes) before updating ------------
# Photos and videos themselves are never touched by an update; this keeps the list of them safe too.
if [ -f "$DATA/family.db" ]; then
	say "Saving a copy of the database first"
	systemctl stop familyweb 2>/dev/null || true
	mkdir -p "$DATA/backups"
	stamp=$(date +%Y-%m-%d-%H%M)
	for f in "$DATA"/family.db "$DATA"/family.db-wal; do
		[ -f "$f" ] && cp -p "$f" "$DATA/backups/$(basename "$f" | sed "s/family/family-$stamp/")"
	done
	chown -R familyweb:familyweb "$DATA/backups" 2>/dev/null || true
	# Keep the 10 most recent
	ls -1t "$DATA"/backups/family-*.db 2>/dev/null | tail -n +11 | while read -r old; do rm -f "$old" "$old-wal"; done
fi

# --- The program itself ----------------------------------------------------------------------
say "Installing the site to $APP"
rm -rf "$APP.new"
mkdir -p "$APP.new"
cp -r "$HERE/build" "$HERE/server.js" "$HERE/package.json" "$APP.new/"
[ -f "$HERE/VERSION" ] && cp "$HERE/VERSION" "$APP.new/"
rm -rf "$APP.old"
[ -d "$APP" ] && mv "$APP" "$APP.old"
mv "$APP.new" "$APP"

# The `update` command: downloads the newest release and runs this script from it
cat >/usr/local/bin/update <<'UPDATE'
#!/usr/bin/env bash
# Updates the family archive to the newest version on GitHub. Photos, videos and accounts are kept.
# `update --force` reinstalls even if it's already the newest.
set -euo pipefail
REPO=$(cat /opt/familyweb/REPO 2>/dev/null || echo irregulur/FamilyWeb)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
echo "Downloading the newest version…"
curl -fsSL "https://github.com/$REPO/releases/latest/download/familyweb-release.tgz" | tar xz -C "$TMP"
if [ "$(cat "$TMP/VERSION")" = "$(cat /opt/familyweb/VERSION 2>/dev/null)" ] && [ "${1:-}" != --force ]; then
	echo "Already up to date (version $(cat /opt/familyweb/VERSION))."
	exit 0
fi
FAMILYWEB_REPO=$REPO bash "$TMP/deploy/install.sh"
UPDATE
chmod +x /usr/local/bin/update
echo "$REPO" >"$APP/REPO"

cat >/etc/systemd/system/familyweb.service <<EOF
[Unit]
Description=Family photo archive
After=network-online.target
Wants=network-online.target

[Service]
User=familyweb
EnvironmentFile=$ENV_FILE
WorkingDirectory=$APP
ExecStart=$(command -v node) server.js
Restart=always
RestartSec=3
# Lets it use port 80 without running as root
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

say "Starting it"
systemctl daemon-reload
systemctl enable familyweb >/dev/null 2>&1
systemctl restart familyweb

port=$(sed -n 's/^PORT=//p' "$ENV_FILE")
for _ in $(seq 30); do
	if curl -fs -o /dev/null "http://127.0.0.1:${port:-80}/login"; then
		rm -rf "$APP.old"
		say "Running ✓ (version $(cat "$APP/VERSION" 2>/dev/null || echo dev))"
		exit 0
	fi
	sleep 1
done
echo "The site didn't start. Last messages:"
journalctl -u familyweb -n 30 --no-pager
if [ -d "$APP.old" ]; then
	say "Going back to the version that was running before"
	rm -rf "$APP"
	mv "$APP.old" "$APP"
	systemctl restart familyweb
fi
exit 1

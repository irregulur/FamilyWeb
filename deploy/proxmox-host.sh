#!/usr/bin/env bash
# Proxmox helper script. In the Proxmox web page: your server → Shell, then paste:
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/irregulur/FamilyWeb/master/deploy/proxmox-host.sh)"
#
# First time: creates a small Debian container called "familyweb" and installs the site in it.
# After that: updates the site inside the existing container. Photos are never touched.
set -euo pipefail

NAME=familyweb
REPO=${FAMILYWEB_REPO:-irregulur/FamilyWeb}
say() { printf '\n\033[1;33m→ %s\033[0m\n' "$*"; }
ask() { local answer; read -rp "$1 " answer </dev/tty; echo "${answer:-$2}"; }

command -v pct >/dev/null || { echo "This doesn't look like a Proxmox server (there's no 'pct' command)."; exit 1; }

CTID=$(pct list | awk -v n="$NAME" 'NR > 1 && $NF == n { print $1; exit }')

FIRST=
if [ -z "$CTID" ]; then
	FIRST=1
	say "First install — a few questions (press Enter to accept the [default])"
	FAMILY=$(ask 'Family name, for the title "The ___ Archive" [Our Family]:' 'Our Family')
	DISK=$(ask 'Space for photos and videos, in GB (18 tapes are ~35 GB after shrinking) [200]:' 200)
	[[ $DISK =~ ^[0-9]+$ ]] || DISK=200
	echo
	echo "Photos are kept inside the container by default (included in Proxmox backups)."
	echo "Or keep them in a folder this Proxmox server can already see, e.g. your NAS mounted at /mnt/pve/nas."
	HOSTDIR=$(ask 'Folder on this server for the photos, or Enter to keep them in the container:' '')
	BRIDGE=$(ask 'Network bridge [vmbr0]:' vmbr0)

	say "Finding a Debian template"
	pveam update >/dev/null || true
	TEMPLATE=$(pveam available --section system | awk '{ print $2 }' | grep -E "^debian-1[23]-standard_.*_$(dpkg --print-architecture)\.tar" | sort -V | tail -1)
	[ -n "$TEMPLATE" ] || { echo "Couldn't find a Debian 12/13 template in 'pveam available'."; exit 1; }
	TEMPLATE_STORE=$(pvesm status -content vztmpl | awk 'NR > 1 && $3 == "active" { print $1; exit }')
	DISK_STORE=$(pvesm status -content rootdir | awk 'NR > 1 && $3 == "active" { print $1 }' | grep -x local-lvm ||
		pvesm status -content rootdir | awk 'NR > 1 && $3 == "active" { print $1; exit }')
	if ! pveam list "$TEMPLATE_STORE" | grep -q "$TEMPLATE"; then
		say "Downloading $TEMPLATE"
		pveam download "$TEMPLATE_STORE" "$TEMPLATE"
	fi

	CTID=$(pvesh get /cluster/nextid)
	CORES=$(( $(nproc) < 4 ? $(nproc) : 4 )) # more cores = tapes shrink faster; costs nothing when idle
	say "Creating container $CTID ($NAME): Debian, $CORES cores, 2 GB memory, ${DISK} GB disk on $DISK_STORE"
	pct create "$CTID" "$TEMPLATE_STORE:vztmpl/$TEMPLATE" \
		--hostname "$NAME" --description "Family photo and video archive" \
		--cores "$CORES" --memory 2048 --swap 512 \
		--rootfs "$DISK_STORE:$DISK" \
		--net0 "name=eth0,bridge=$BRIDGE,ip=dhcp" \
		--unprivileged 1 --features nesting=1 --onboot 1

	if [ -n "$HOSTDIR" ]; then
		mkdir -p "$HOSTDIR"
		# The site runs as user 1990 inside the container, which is 101990 out here.
		chown 101990:101990 "$HOSTDIR" ||
			echo "Warning: couldn't change the owner of $HOSTDIR. If uploads fail, give user 101990 write access to it on the NAS."
		pct set "$CTID" --mp0 "$HOSTDIR,mp=/var/lib/familyweb"
	fi
fi

if [ "$(pct status "$CTID" | awk '{ print $2 }')" != running ]; then
	say "Starting container $CTID"
	pct start "$CTID"
fi

say "Waiting for the container's network"
for i in $(seq 60); do
	pct exec "$CTID" -- getent hosts deb.debian.org >/dev/null 2>&1 && break
	[ "$i" = 60 ] && { echo "The container has no internet connection (needed once, to install Node.js and ffmpeg)."; exit 1; }
	sleep 1
done

if pct exec "$CTID" -- test -x /usr/local/bin/update; then
	say "Updating the site inside container $CTID"
	pct exec "$CTID" -- update
else
	say "Installing the site inside container $CTID"
	pct exec "$CTID" -- env FAMILY_NAME="${FAMILY:-Our Family}" FAMILYWEB_REPO="$REPO" bash -c '
		set -e
		command -v curl >/dev/null || { apt-get update -qq && apt-get install -y -qq curl ca-certificates >/dev/null; }
		rm -rf /root/familyweb-release && mkdir /root/familyweb-release
		curl -fsSL "https://github.com/$FAMILYWEB_REPO/releases/latest/download/familyweb-release.tgz" | tar xz -C /root/familyweb-release
		bash /root/familyweb-release/deploy/install.sh
		rm -rf /root/familyweb-release'
fi

IP=$(pct exec "$CTID" -- hostname -I | awk '{ print $1 }')
say "Done! Open http://$IP in a browser."
[ -n "$FIRST" ] && echo "  First visit: create your own account (you become the owner), then invite the family from the Family page."
echo "  Container: $CTID ($NAME). Settings: /etc/familyweb.env inside it."
echo "  To update later: paste the same line again, or type 'update' in the container's Console."

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
export LANG=C.UTF-8 LC_ALL=C.UTF-8 # Debian containers only have this one; avoids pages of locale warnings
say() { printf '\n\033[1;33m→ %s\033[0m\n' "$*"; }

command -v pct >/dev/null || { echo "This doesn't look like a Proxmox server (there's no 'pct' command)."; exit 1; }

CTID=$(pct list | awk -v n="$NAME" 'NR > 1 && $NF == n { print $1; exit }')

# --- Menus (the same blue boxes as the community helper scripts) ------------------------------
TITLE="Family Archive"
box() { whiptail --backtitle "Family Archive · Proxmox helper" --title "$TITLE" "$@" 3>&1 1>&2 2>&3; }
cancelled() { clear; echo "Cancelled, nothing was changed."; exit 0; }
gb() { awk -v k="$1" 'BEGIN { printf "%d", k / 1024 / 1024 }'; } # KiB → GB
# Folder of a Proxmox storage (NAS shares added under Datacenter → Storage live in /mnt/pve/<name>)
store_path() { awk -v id="$1" '/^[a-z]+: / { cur = $2 } cur == id && $1 == "path" { print $2; exit }' /etc/pve/storage.cfg; }
# Can the site's user (1990 inside the container = 101990 out here) write to a folder?
writable() { setpriv --reuid=101990 --regid=101990 --clear-groups sh -c "touch '$1/.familyweb-test' && rm '$1/.familyweb-test'" 2>/dev/null; }

FIRST=
if [ -z "$CTID" ]; then
	FIRST=1
	command -v whiptail >/dev/null || { apt-get update -qq && apt-get install -y -qq whiptail >/dev/null; }

	box --msgbox "This sets up the family photo & video archive in its own small container.\n\nThe program goes on your Proxmox storage; the photos and videos can go on your NAS." 11 64 || cancelled

	FAMILY=$(box --inputbox "Family name, for the title \"The ___ Archive\":" 9 64 "Our Family") || cancelled
	[ -n "$FAMILY" ] || FAMILY="Our Family"

	# 1. Where the container (program + database) goes
	MENU=()
	while read -r id type _ _ _ avail _; do
		MENU+=("$id" "$type · $(gb "$avail") GB free")
	done < <(pvesm status -content rootdir | awk 'NR > 1 && $3 == "active"')
	[ ${#MENU[@]} -gt 0 ] || { echo "No storage for containers found (Datacenter → Storage)."; exit 1; }
	DEFAULT=$(printf '%s\n' "${MENU[@]}" | grep -x local-lvm || echo "${MENU[0]}")
	DISK_STORE=$(box --default-item "$DEFAULT" --menu "Where should the container (the program itself) be installed?" 16 64 6 "${MENU[@]}") || cancelled
	FREE=$(gb "$(pvesm status --storage "$DISK_STORE" | awk 'NR == 2 { print $6 }')")

	# 2. Where the photos and videos go
	MENU=()
	while read -r id type _ _ _ avail _; do
		path=$(store_path "$id")
		[ -n "$path" ] && [ "$id" != "$DISK_STORE" ] && MENU+=("$id" "$type · $(gb "$avail") GB free · $path/familyweb")
	done < <(pvesm status | awk 'NR > 1 && $3 == "active" && $2 ~ /^(nfs|cifs|dir|cephfs|glusterfs)$/')
	MENU+=("folder" "Type a folder on this server myself")
	MENU+=("container" "Inside the container, on $DISK_STORE ($FREE GB free)")
	PHOTOS=$(box --menu "Where should the photos and videos be kept?\n(18 tapes are ~35 GB after shrinking, plus the photos. NAS shares appear here once added under Datacenter → Storage.)" 20 78 8 "${MENU[@]}") || cancelled

	HOSTDIR=
	case "$PHOTOS" in
		container) ;;
		folder) HOSTDIR=$(box --inputbox "Folder on this Proxmox server for the photos and videos:" 9 70 "/mnt/pve/") || cancelled ;;
		*) HOSTDIR="$(store_path "$PHOTOS")/familyweb" ;;
	esac

	if [ -n "$HOSTDIR" ]; then
		DISK=16 # just the program and the database
		mkdir -p "$HOSTDIR" || { box --msgbox "Couldn't create $HOSTDIR. Is the NAS share mounted?" 8 70; exit 1; }
		chown 101990:101990 "$HOSTDIR" 2>/dev/null || true
		if ! writable "$HOSTDIR"; then
			box --yesno "The site won't be able to save files in\n$HOSTDIR\n\nIt runs as user 101990 on this server. Give that user write access on the NAS, for example:\n • NFS share: set \"Squash\" to \"Map all users to admin\" (Synology) or mapall/maproot (TrueNAS)\n • SMB/CIFS storage: add the mount options uid=101990,gid=101990\n\nContinue anyway and fix it afterwards?" 18 78 || cancelled
		fi
	else
		[ "${FREE:-0}" -ge 20 ] || { box --msgbox "There isn't enough free space on $DISK_STORE ($FREE GB). Choose a NAS folder instead." 8 70; exit 1; }
		# Never more than is really free: Proxmox lets you hand out more than exists, and when it really
		# runs out, every container and VM on that storage breaks.
		SUGGEST=$(( FREE * 7 / 10 < 200 ? FREE * 7 / 10 : 200 ))
		DISK=$(box --inputbox "Space for photos and videos, in GB ($FREE GB free on $DISK_STORE):" 9 70 "$SUGGEST") || cancelled
		[[ $DISK =~ ^[0-9]+$ ]] && [ "$DISK" -le $(( FREE * 9 / 10 )) ] || DISK=$SUGGEST
	fi

	# 3. Network
	BRIDGES=$(ls /sys/class/net | grep '^vmbr' || echo vmbr0)
	if [ "$(echo "$BRIDGES" | wc -l)" -gt 1 ]; then
		MENU=(); for b in $BRIDGES; do MENU+=("$b" ""); done
		BRIDGE=$(box --menu "Network bridge:" 14 50 5 "${MENU[@]}") || cancelled
	else
		BRIDGE=$BRIDGES
	fi

	CORES=$(( $(nproc) < 4 ? $(nproc) : 4 )) # more cores = tapes shrink faster; costs nothing when idle
	box --yesno "Ready to install:\n\n  Title:        The $FAMILY Archive\n  Container:    $DISK GB on $DISK_STORE, $CORES cores, 2 GB memory\n  Photos/videos: ${HOSTDIR:-inside the container}\n  Network:      $BRIDGE (address from your router)\n\nGo ahead?" 15 74 || cancelled
	clear

	say "Finding a Debian template"
	pveam update >/dev/null || true
	TEMPLATE=$(pveam available --section system | awk '{ print $2 }' | grep -E "^debian-1[23]-standard_.*_$(dpkg --print-architecture)\.tar" | sort -V | tail -1)
	[ -n "$TEMPLATE" ] || { echo "Couldn't find a Debian 12/13 template in 'pveam available'."; exit 1; }
	TEMPLATE_STORE=$(pvesm status -content vztmpl | awk 'NR > 1 && $3 == "active" { print $1; exit }')
	if ! pveam list "$TEMPLATE_STORE" | grep -q "$TEMPLATE"; then
		say "Downloading $TEMPLATE"
		pveam download "$TEMPLATE_STORE" "$TEMPLATE"
	fi

	CTID=$(pvesh get /cluster/nextid)
	say "Creating container $CTID ($NAME): Debian, $CORES cores, 2 GB memory, ${DISK} GB disk on $DISK_STORE"
	pct create "$CTID" "$TEMPLATE_STORE:vztmpl/$TEMPLATE" \
		--hostname "$NAME" --description "Family photo and video archive" \
		--cores "$CORES" --memory 2048 --swap 512 \
		--rootfs "$DISK_STORE:$DISK" \
		--net0 "name=eth0,bridge=$BRIDGE,ip=dhcp" \
		--unprivileged 1 --features nesting=1 --onboot 1

	if [ -n "$HOSTDIR" ]; then
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

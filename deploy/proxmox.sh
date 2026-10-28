#!/usr/bin/env bash
# Puts the site on your Proxmox server, from this computer. One command:
#
#     pnpm proxmox 192.168.1.10        (your Proxmox server's address)
#
# The first time it creates a container and asks a few questions. Run it again after changes
# to update the site; photos, videos and accounts are kept.
# It logs in to Proxmox as root over SSH, so you'll be asked for the root password (once).
set -euo pipefail

HOST=${1:-}
if [ -z "$HOST" ]; then
	echo "Usage: pnpm proxmox <proxmox-address>     e.g. pnpm proxmox 192.168.1.10"
	echo "(The address you open the Proxmox web page on, without https:// and :8006.)"
	exit 1
fi
HOST=${HOST#https://}
HOST=${HOST%%:*}
cd "$(dirname "$0")/.."

say() { printf '\n\033[1;33m→ %s\033[0m\n' "$*"; }
TMP=$(mktemp -d)
SOCKET="$TMP/ssh"
trap 'ssh -o ControlPath="$SOCKET" -O exit "root@$HOST" 2>/dev/null; rm -rf "$TMP"' EXIT

say "Building the site"
pnpm install --frozen-lockfile --silent
pnpm build >"$TMP/build.log" 2>&1 || { cat "$TMP/build.log"; exit 1; }
tar czf "$TMP/familyweb-release.tgz" build server.js package.json deploy/install.sh

say "Connecting to root@$HOST"
# One shared connection, so the password is asked only once
SSH_OPTS=(-o ControlMaster=auto -o ControlPath="$SOCKET" -o ControlPersist=600 -o StrictHostKeyChecking=accept-new)
ssh "${SSH_OPTS[@]}" "root@$HOST" true
scp -q "${SSH_OPTS[@]}" "$TMP/familyweb-release.tgz" deploy/proxmox-host.sh "root@$HOST:/tmp/"
ssh -t "${SSH_OPTS[@]}" "root@$HOST" 'bash /tmp/proxmox-host.sh; status=$?; rm -f /tmp/proxmox-host.sh; exit $status'

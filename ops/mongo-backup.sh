#!/bin/bash
#
# Nightly MongoDB backup.
#
# Guards against the failure that actually happens: a bad write wiping a field
# or a collection, with no way back. It does NOT protect against losing the VPS
# itself — the archives sit on the same disk as the database. Copying them off
# the box is a separate, still-open step.
#
# Restore one database:
#   mongorestore --gzip --archive=/var/backups/mongo/daily/damndeal-2026-08-16.gz \
#                --nsInclude='damndeal.*' --drop
#
# Restore a single collection into a scratch name, so nothing live is touched:
#   mongorestore --gzip --archive=<file> \
#                --nsInclude='damndeal.couponcampaigns' \
#                --nsFrom='damndeal.couponcampaigns' \
#                --nsTo='damndeal_restore.couponcampaigns'
#
set -uo pipefail

DBS="damndeal adsservices magicclub roadhustler"
ROOT="/var/backups/mongo"
DAILY="$ROOT/daily"
MONTHLY="$ROOT/monthly"
LOG="/var/log/mongo-backup.log"
KEEP_DAILY=30          # ~60 MB at today's sizes
KEEP_MONTHLY=12

DATE=$(date +%F)
DOM=$(date +%d)

mkdir -p "$DAILY" "$MONTHLY"

log() { echo "$(date '+%F %T') $*" >> "$LOG"; }

log "=== backup start ==="
failed=0

for db in $DBS; do
  out="$DAILY/$db-$DATE.gz"
  if mongodump --quiet --db="$db" --gzip --archive="$out" 2>>"$LOG"; then
    size=$(stat -c %s "$out" 2>/dev/null || echo 0)
    # An archive that small is an empty or truncated dump, not a real backup.
    if [ "$size" -lt 1024 ]; then
      log "FAIL $db — archive only ${size}B"
      rm -f "$out"
      failed=1
      continue
    fi
    log "ok   $db  $((size / 1024)) KB"
    # Keep the 1st of each month out of the daily rotation.
    if [ "$DOM" = "01" ]; then
      cp -f "$out" "$MONTHLY/$db-$DATE.gz"
    fi
  else
    log "FAIL $db — mongodump exited $?"
    rm -f "$out"
    failed=1
  fi
done

# Rotate. Sorted by name, which is sorted by date because of the YYYY-MM-DD.
for db in $DBS; do
  ls -1 "$DAILY/$db-"*.gz 2>/dev/null | head -n -"$KEEP_DAILY" | xargs -r rm -f
  ls -1 "$MONTHLY/$db-"*.gz 2>/dev/null | head -n -"$KEEP_MONTHLY" | xargs -r rm -f
done

total=$(du -sh "$ROOT" 2>/dev/null | cut -f1)
log "=== backup done (failures: $failed, total on disk: $total) ==="
exit $failed

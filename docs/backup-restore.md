# ARJUN API MANAGER — BACKUP & DISASTER RECOVERY

## 1. Backup Strategy
- **MongoDB**: Point-in-time snapshots and daily automated mongodump archives.
- **Redis**: RDB snapshots (`dump.rdb`) with AOF (Append-Only File) enabled for durability.

## 2. Manual Backup Trigger
Admins can trigger manual database snapshots from the Super Admin Dashboard under **Backups**, or via the API:

```bash
curl -X POST "https://api.karviontechnologies.in/api/v1/admin/backups" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

CLI Mongodump Backup:
```bash
docker exec -t arjun-mongodb mongodump --db arjun_api_manager --archive=/data/db/backup-$(date +%F).archive --gzip
```

## 3. Restoration Procedure
To restore from a backup archive:

```bash
docker exec -i arjun-mongodb mongorestore --db arjun_api_manager --archive=/data/db/backup-YYYY-MM-DD.archive --gzip --drop
```

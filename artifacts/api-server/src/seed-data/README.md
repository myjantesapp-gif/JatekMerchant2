# Public catalog snapshot

`public-catalog.json` is the reproducible public-content snapshot built from
read-only development and production exports. It contains only:

- public categories and product categories;
- public shop metadata;
- products;
- ads;
- Shorts;
- references to managed media objects.

It does not contain users, owners, drivers, orders, addresses, payments,
sessions, secrets, or legal identity fields. Production wins when the same
stable key exists in both exports. Database IDs are deliberately absent from
the snapshot; the importer remaps every relation to IDs in the target
database.

## Import

Run the explicit importer against the intended database:

```bash
pnpm --filter @workspace/api-server run import:public-catalog
```

The importer is idempotent and non-destructive. It inserts missing rows only,
uses an existing admin or super-admin as the owner of a newly inserted shop,
and never deletes or updates existing catalog, operational, account, or media
data. It is intentionally not called from API startup or the production seed.

## Media

Media restoration remains a separate verified step:

```bash
bash scripts/restore-media-archive.sh <verified-media.tar.gz> <confirmed-bucket-id>
```

The current snapshot references 72 managed objects. The existing local media
archive does not contain the six production-only banner/Short objects, so a
fresh production App Storage export must be verified before restoring the
complete merged media set.

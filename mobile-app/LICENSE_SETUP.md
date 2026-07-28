# License Key Setup

This app now requires a valid license key on first launch.

## 1) Create the database objects

In Supabase SQL editor, run:

`create_app_licenses.sql`

This creates:
- `public.app_licenses`
- `public.app_license_activations`
- RPCs:
  - `activate_app_license(...)`
  - `validate_app_license_activation(...)`
  - `create_app_license(...)` (admin helper)

## 2) Create a license key for your client

Example:

```sql
SELECT public.create_app_license(
  'QATAR-CLIENT-KEY-001',
  'Qatar Client',
  'com.dohaextraco.pt',
  5,
  NULL
);
```

- Third argument must match `Application.applicationId` / bundle id.
- `5` is max activated devices.

## 3) App behavior

- On first launch, app shows a license activation screen.
- User enters the key.
- App calls `activate_app_license`.
- On every launch, app calls `validate_app_license_activation`.
- If key becomes revoked/invalid, app returns to activation screen.

## 4) Revoke a device or key

Revoke single device activation:

```sql
UPDATE public.app_license_activations
SET is_revoked = true
WHERE id = '<activation_uuid>';
```

Disable full key:

```sql
UPDATE public.app_licenses
SET is_active = false
WHERE id = '<license_uuid>';
```

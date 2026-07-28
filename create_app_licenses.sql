-- License key infrastructure for mobile app activation
-- Run in Supabase SQL editor as project owner.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.app_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key_hash TEXT NOT NULL UNIQUE,
    customer_name TEXT,
    app_slug TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    max_activations INTEGER NOT NULL DEFAULT 1 CHECK (max_activations > 0),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_license_activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES public.app_licenses(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL,
    app_slug TEXT,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (license_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_app_licenses_active
    ON public.app_licenses(is_active);

CREATE INDEX IF NOT EXISTS idx_app_license_activations_license
    ON public.app_license_activations(license_id);

CREATE INDEX IF NOT EXISTS idx_app_license_activations_device
    ON public.app_license_activations(device_fingerprint);

ALTER TABLE public.app_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_license_activations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.app_licenses FROM anon, authenticated;
REVOKE ALL ON public.app_license_activations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_timestamp_on_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_app_licenses_updated_at ON public.app_licenses;
CREATE TRIGGER trg_set_app_licenses_updated_at
BEFORE UPDATE ON public.app_licenses
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamp_on_update();

CREATE OR REPLACE FUNCTION public.activate_app_license(
    p_license_key TEXT,
    p_device_fingerprint TEXT,
    p_app_slug TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_license public.app_licenses%ROWTYPE;
    v_existing_activation_id UUID;
    v_active_activation_count INTEGER;
    v_license_key_hash TEXT;
BEGIN
    IF p_license_key IS NULL OR LENGTH(TRIM(p_license_key)) < 8 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid license key format.');
    END IF;

    IF p_device_fingerprint IS NULL OR LENGTH(TRIM(p_device_fingerprint)) < 8 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid device fingerprint.');
    END IF;

    v_license_key_hash := encode(extensions.digest(TRIM(p_license_key), 'sha256'), 'hex');

    SELECT *
    INTO v_license
    FROM public.app_licenses
    WHERE license_key_hash = v_license_key_hash
      AND is_active = true
      AND (app_slug IS NULL OR app_slug = p_app_slug)
    LIMIT 1;

    IF v_license.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'License key is invalid or inactive.');
    END IF;

    IF v_license.expires_at IS NOT NULL AND v_license.expires_at < NOW() THEN
        RETURN jsonb_build_object('success', false, 'message', 'License key has expired.');
    END IF;

    SELECT id
    INTO v_existing_activation_id
    FROM public.app_license_activations
    WHERE license_id = v_license.id
      AND device_fingerprint = p_device_fingerprint
      AND is_revoked = false
    LIMIT 1;

    IF v_existing_activation_id IS NOT NULL THEN
        UPDATE public.app_license_activations
        SET last_validated_at = NOW()
        WHERE id = v_existing_activation_id;

        RETURN jsonb_build_object('success', true, 'message', 'License already active on this device.');
    END IF;

    SELECT COUNT(*)
    INTO v_active_activation_count
    FROM public.app_license_activations
    WHERE license_id = v_license.id
      AND is_revoked = false;

    IF v_active_activation_count >= v_license.max_activations THEN
        RETURN jsonb_build_object('success', false, 'message', 'Activation limit reached for this license key.');
    END IF;

    INSERT INTO public.app_license_activations (
        license_id,
        device_fingerprint,
        app_slug
    ) VALUES (
        v_license.id,
        p_device_fingerprint,
        p_app_slug
    );

    RETURN jsonb_build_object('success', true, 'message', 'License activated successfully.');
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_app_license_activation(
    p_license_key TEXT,
    p_device_fingerprint TEXT,
    p_app_slug TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_license_id UUID;
    v_activation_id UUID;
    v_license_key_hash TEXT;
BEGIN
    IF p_license_key IS NULL OR p_device_fingerprint IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'message', 'License validation failed.');
    END IF;

    v_license_key_hash := encode(extensions.digest(TRIM(p_license_key), 'sha256'), 'hex');

    SELECT id
    INTO v_license_id
    FROM public.app_licenses
    WHERE license_key_hash = v_license_key_hash
      AND is_active = true
      AND (expires_at IS NULL OR expires_at >= NOW())
      AND (app_slug IS NULL OR app_slug = p_app_slug)
    LIMIT 1;

    IF v_license_id IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'message', 'License key is invalid or inactive.');
    END IF;

    SELECT id
    INTO v_activation_id
    FROM public.app_license_activations
    WHERE license_id = v_license_id
      AND device_fingerprint = p_device_fingerprint
      AND is_revoked = false
    LIMIT 1;

    IF v_activation_id IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'message', 'This device is not activated for the license key.');
    END IF;

    UPDATE public.app_license_activations
    SET last_validated_at = NOW()
    WHERE id = v_activation_id;

    RETURN jsonb_build_object('valid', true, 'message', 'License validation successful.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_app_license(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_app_license_activation(TEXT, TEXT, TEXT) TO anon, authenticated;

-- Optional helper for admin: stores hash, never the plain key.
-- Example:
-- SELECT public.create_app_license('QATAR-CLIENT-KEY-001', 'Qatar Client', 'com.dohaextraco.pt', 5, NULL);
CREATE OR REPLACE FUNCTION public.create_app_license(
    p_plain_license_key TEXT,
    p_customer_name TEXT,
    p_app_slug TEXT DEFAULT NULL,
    p_max_activations INTEGER DEFAULT 1,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_license_id UUID;
BEGIN
    IF p_plain_license_key IS NULL OR LENGTH(TRIM(p_plain_license_key)) < 8 THEN
        RAISE EXCEPTION 'License key must be at least 8 characters.';
    END IF;

    INSERT INTO public.app_licenses (
        license_key_hash,
        customer_name,
        app_slug,
        max_activations,
        expires_at
    )
    VALUES (
        encode(extensions.digest(TRIM(p_plain_license_key), 'sha256'), 'hex'),
        p_customer_name,
        p_app_slug,
        COALESCE(p_max_activations, 1),
        p_expires_at
    )
    RETURNING id INTO v_license_id;

    RETURN v_license_id;
END;
$$;

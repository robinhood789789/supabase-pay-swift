-- Create custom types (ignore if already exists)
DO $$ BEGIN
    CREATE TYPE public.kyc_verification_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.kyc_document_type AS ENUM ('national_id', 'passport', 'driving_license', 'business_registration', 'bank_statement', 'utility_bill', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.tx_type AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'REFUND', 'FEE', 'ADJUSTMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.tx_direction AS ENUM ('IN', 'OUT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.tx_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.tx_method AS ENUM ('BANK_TRANSFER', 'CARD', 'PROMPTPAY', 'CASH', 'WALLET', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.api_key_type AS ENUM ('public', 'secret');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
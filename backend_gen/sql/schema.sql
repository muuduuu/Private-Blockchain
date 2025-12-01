-- CAMTC Ledger PostgreSQL schema
CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    contact JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    primary_provider_id TEXT REFERENCES providers(id),
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS validators (
    id TEXT PRIMARY KEY,
    tier TEXT NOT NULL,
    reputation NUMERIC(4,2) NOT NULL,
    blocks_proposed INTEGER DEFAULT 0,
    uptime NUMERIC(5,2) DEFAULT 0,
    last_seen TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address TEXT UNIQUE NOT NULL,
    address_normalized TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    label TEXT,
    public_key TEXT,
    roles TEXT[] DEFAULT ARRAY['clinician'],
    status TEXT DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES patients(id),
    provider_id TEXT REFERENCES providers(id),
    type TEXT NOT NULL,
    tier INTEGER NOT NULL,
    priority NUMERIC(5,3) NOT NULL,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'Pending',
    signature TEXT,
    block_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_patient ON transactions(patient_id);
CREATE INDEX IF NOT EXISTS idx_transactions_provider ON transactions(provider_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

CREATE TABLE IF NOT EXISTS audit_log (
    sequence BIGSERIAL PRIMARY KEY,
    entry_id TEXT UNIQUE NOT NULL,
    actor_id TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    outcome TEXT NOT NULL,
    patient_id TEXT,
    ip_address TEXT,
    block_hash TEXT,
    prev_hash TEXT,
    integrity_hash TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_patient ON audit_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource);

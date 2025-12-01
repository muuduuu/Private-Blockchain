-- Seed providers
INSERT INTO providers (id, name, specialty, contact)
VALUES
    ('prov-01', 'Dr. Elena Martinez', 'Emergency', '{"pager":"555-0101"}'),
    ('prov-02', 'Dr. Amir Hassan', 'Cardiology', '{"pager":"555-0102"}'),
    ('prov-03', 'Dr. Priya Patel', 'Neurology', '{"pager":"555-0103"}'),
    ('prov-04', 'Dr. Hannah Lewis', 'Pharmacy', '{"pager":"555-0104"}')
ON CONFLICT (id) DO NOTHING;

-- Seed patients
INSERT INTO patients (id, full_name, date_of_birth, primary_provider_id)
VALUES
    ('CAMTC-1000', 'Patient 1', '1984-04-15', 'prov-01'),
    ('CAMTC-1001', 'Patient 2', '1986-05-15', 'prov-02'),
    ('CAMTC-1002', 'Patient 3', '1987-06-15', 'prov-03')
ON CONFLICT (id) DO NOTHING;

-- Seed validators
INSERT INTO validators (id, tier, reputation, blocks_proposed, uptime, last_seen)
VALUES
    ('VAL-1', 'Tier-1', 0.95, 1450, 99.12, NOW()),
    ('VAL-2', 'Tier-1', 0.91, 1390, 98.70, NOW() - INTERVAL '3 minutes'),
    ('VAL-3', 'Tier-2', 0.82, 1205, 96.40, NOW() - INTERVAL '8 minutes')
ON CONFLICT (id) DO NOTHING;

-- Seed transactions
INSERT INTO transactions (id, patient_id, provider_id, type, tier, priority, payload, status, signature, block_hash)
VALUES
    ('TX-1400', 'CAMTC-1000', 'prov-01', 'Emergency Record', 1, 0.92, '{"severity":"critical","notes":"Initial admission"}', 'Confirmed', '0xdeadbeef', '0xabc123'),
    ('TX-1401', 'CAMTC-1001', 'prov-04', 'Pharmacy Order', 2, 0.74, '{"medication":"Atorvastatin","dose":"20mg"}', 'Pending', '0xdeadbeef', NULL)
ON CONFLICT (id) DO NOTHING;

-- Seed audit entries
INSERT INTO audit_log (entry_id, actor_id, actor_type, action, resource, outcome, patient_id, prev_hash, integrity_hash, tags, metadata)
VALUES
    ('AUD-2000', 'prov-01', 'provider', 'Create', 'transaction:TX-1400', 'success', 'CAMTC-1000', 'root', 'hash-1', ARRAY['clinical','tier1'], '{"details":"Emergency submission"}'),
    ('AUD-2001', 'prov-04', 'provider', 'Create', 'transaction:TX-1401', 'success', 'CAMTC-1001', 'hash-1', 'hash-2', ARRAY['pharmacy'], '{"details":"Medication order"}')
ON CONFLICT (entry_id) DO NOTHING;

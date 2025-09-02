-- seed tiers (contoh)
INSERT INTO tiers (code, name, min_lifetime_spend_cents, multiplier, perks) VALUES
('BRONZE','Bronze', 0,         1.0, '{}'),
('SILVER','Silver', 5000000,   1.2, '{"free_shipping_threshold":"300000"}'),
('GOLD',  'Gold',   15000000,  1.5, '{"priority_support":true}')
ON CONFLICT (code) DO NOTHING;

-- earn rules dasar:
-- type: per_currency_spent, value: "per rupiah yang dihitung per 100000" → simpan sebagai divider di meta agar fleksibel
INSERT INTO earn_rules(type, value, meta, active)
VALUES ('per_currency_spent', 100, '{"per_cents":1000}', TRUE)
ON CONFLICT DO NOTHING;

-- optional: signup bonus
INSERT INTO earn_rules(type, value, meta, active)
VALUES ('signup_bonus', 200, '{}', TRUE)
ON CONFLICT DO NOTHING;
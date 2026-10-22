-- 5 dummy LinkedIn leads for testing
-- Run this in Supabase SQL editor

INSERT INTO linkedin_leads (id, place_id, lead_name, title, email, email_status, linkedin_url, source, notes, created_at, updated_at)
VALUES
  ('3deadbd8-6f45-49d3-9f27-6ce44b3d24ff', 'place_001', 'Sarah Chen', 'Product Manager', 'sarah.chen@acme.io', 'verified', 'https://linkedin.com/in/sarahchen', 'apollo_enrichment', 'Needs follow-up on integration API.', '2026-10-14T09:00:00Z', '2026-10-14T12:30:00Z'),
  ('4e2f1ca3-7056-5a4e-0f34-7b9e88d2351a', 'place_002', 'Marcus Rodriguez', 'Head of Growth', 'marcus.r@scaleup.ai', 'unverified', 'https://linkedin.com/in/marcusr', 'apollo_enrichment', 'Interested in dialer integration.', '2026-10-15T10:15:00Z', '2026-10-15T14:20:00Z'),
  ('5a7f4019-7832-6e77-3c4c-3e4f307e1899', 'place_003', 'Emma Thompson', 'CTO', 'emma@techflow.io', 'verified', 'https://linkedin.com/in/emmatho', 'manual', 'Wants call recording feature.', '2026-10-13T11:45:00Z', '2026-10-14T16:10:00Z'),
  ('6c6a673b-2c6d-2d80-9b6c-367e6a1c2b66', 'place_004', 'David Kim', 'Senior Sales Rep', 'david.kim@saasco.com', 'unverified', 'https://linkedin.com/in/davidkim', 'apollo_enrichment', 'Hot lead - needs immediate follow-up.', '2026-10-16T08:00:00Z', '2026-10-16T09:30:00Z'),
  ('7b6a0a94-a14a-72b6-ec0d-8f6e052c0b20', 'place_005', 'Lisa Wang', 'Revenue Operations', 'lisa.w@proptech.co', 'verified', 'https://linkedin.com/in/lisaw', 'manual', 'Evaluating dialer for team of 5 reps.', '2026-10-12T14:00:00Z', '2026-10-15T11:20:00Z');

-- Now 2 dummy leads for leads table (Google Maps style)
INSERT INTO leads (id, place_id, lead_name, title, email, phone, address, status, source, notes, assigned_to, next_follow_up_at, created_at, updated_at)
VALUES
  ('dddff812-1597-44b9-a29a-4977221d704d', 'gm_001', 'Robert Johnson', 'Sales Director', 'rob.johnson@gmb.com', '+1 (555) 234-5678', '123 Main St, Austin, TX 78701', 'new', 'google_maps', 'Interested in call recording feature', NULL, NULL, '2026-10-15T10:30:00Z', '2026-10-16T14:15:00Z'),
  ('deadbeef-1234-5678-9abc-def012345678', 'gm_002', 'Jennifer Adams', 'Marketing Manager', 'jen.adams@retailco.com', '+1 (555) 876-5432', '456 Oak Ave, Denver, CO 80202', 'interested', 'google_maps', 'Wants demo of dialer dashboard', NULL, '2026-10-18T09:00:00Z', '2026-10-16T16:45:00Z');

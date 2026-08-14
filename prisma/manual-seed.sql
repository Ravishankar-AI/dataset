-- Manual seed script, mirroring prisma/seed.ts.
--
-- Exists because this workspace's sandbox can't open a raw Postgres
-- connection to Supabase (only HTTPS is reachable here), so `npm run
-- db:seed` can't run from it. Paste this into the Supabase SQL Editor
-- instead. If prisma/seed.ts ever changes, this file needs updating by
-- hand to match — it is not derived automatically.

insert into "Modality" (id, key, name, "sensorManifest", "sensorNote", "typicalUse") values
  ('mod_egocentric', 'egocentric', 'Egocentric', 'Camera + IMU', '+ LiDAR on supported rigs', 'First-person task and object-interaction data for imitation learning.'),
  ('mod_exocentric', 'exocentric', 'Exocentric', 'Fixed multi-camera', 'Synced 2-6 viewpoints', 'Third-person scene coverage for spatial reasoning and multi-view training.'),
  ('mod_teleop', 'teleop', 'Teleop', 'Arm joint states', '+ camera + operator input log', 'Operator-driven manipulation traces for policy training and action labeling.'),
  ('mod_umi_gripper', 'umi_gripper', 'UMI Gripper', 'Handheld gripper cam', '+ force/width sensing', 'In-the-wild grasp and manipulation capture without a fixed rig.'),
  ('mod_tactile', 'tactile', 'Tactile', 'Tactile array', '+ contact camera', 'Contact-rich manipulation data for grasp stability and slip detection.'),
  ('mod_mocap', 'mocap', 'MOCAP', 'Marker-based rig', '+ synced reference camera', 'Ground-truth kinematic trajectories for humanoid whole-body motion.');

insert into "Organization" (id, name, slug) values
  ('org_acme_robotics', 'Acme Robotics', 'acme-robotics');

insert into "User" (id, email, name, role, "organizationId") values
  ('usr_admin', 'ravi@objectways.com', 'Ravi', 'admin', null),
  ('usr_contributor', 'capture-team@objectways.com', 'Capture Team', 'contributor', null),
  ('usr_customer', 'ml-lead@acme-robotics.example', 'Acme ML Lead', 'customer', 'org_acme_robotics');

insert into "Dataset" (id, slug, title, description, "modalityId", "accessTier", status, version, "sizeBytes", "objectPrefix", "updatedAt") values
  ('ds_egotask_sample', 'egotask-sample', 'EgoTask — Sample', 'Long-horizon task interaction clips for embodied AI and multistep robotics learning.', 'mod_egocentric', 'sample', 'published', 'v1', 2500000000, 'samples/egotask-sample/', now()),
  ('ds_egograsp_sample', 'egograsp-sample', 'EgoGrasp — Sample', 'Close-range hand-object interaction clips for dexterous manipulation models.', 'mod_egocentric', 'sample', 'published', 'v1', 2500000000, 'samples/egograsp-sample/', now()),
  ('ds_teleop_kitchen_sample', 'teleop-kitchen-sample', 'Teleop Kitchen — Sample', 'Operator-driven kitchen manipulation traces with synced joint state logs.', 'mod_teleop', 'sample', 'published', 'v1', 2500000000, 'samples/teleop-kitchen-sample/', now()),
  ('ds_mocap_locomotion_sample', 'mocap-locomotion-sample', 'MOCAP Locomotion — Sample', 'Marker-based whole-body locomotion trajectories for humanoid gait training.', 'mod_mocap', 'sample', 'published', 'v1', 2500000000, 'samples/mocap-locomotion-sample/', now()),
  ('ds_egograsp_acme_v2', 'egograsp-acme-v2', 'EgoGrasp — Acme Custom Capture', 'Custom EgoGrasp campaign scoped to Acme''s warehouse SKUs, 40 hours across 3 sites.', 'mod_egocentric', 'customer', 'published', 'v2', 1400000000000, 'datasets/egograsp-acme-v2/', now()),
  ('ds_egonav_indoor_draft', 'egonav-indoor-draft', 'EgoNav — Indoor Navigation (in review)', 'GPS-denied indoor navigation traces through malls, offices, and staircases.', 'mod_exocentric', 'customer', 'draft', 'v1', 0, 'datasets/egonav-indoor-draft/', now());

insert into "Entitlement" (id, "organizationId", "datasetId") values
  ('ent_acme_egograsp_v2', 'org_acme_robotics', 'ds_egograsp_acme_v2');

insert into "Episode" (id, "datasetId", "capturedAt", "durationSeconds", "sizeBytes", "objectKey", status, "rejectionReason") values
  ('ep_001', 'ds_egonav_indoor_draft', now() - interval '2 hours', 340, 80000000, 'datasets/egonav-indoor-draft/episode-001.mp4', 'cataloged', null),
  ('ep_002', 'ds_egonav_indoor_draft', now() - interval '5 hours', 512, 92000000, 'datasets/egonav-indoor-draft/episode-002.mp4', 'cataloged', null),
  ('ep_003', 'ds_egonav_indoor_draft', now() - interval '1 hours', 280, 104000000, 'datasets/egonav-indoor-draft/episode-003.mp4', 'validating', null),
  ('ep_004', 'ds_egonav_indoor_draft', now() - interval '0.2 hours', 190, 116000000, 'datasets/egonav-indoor-draft/episode-004.mp4', 'queued', null),
  ('ep_005', 'ds_egonav_indoor_draft', now() - interval '8 hours', 95, 128000000, 'datasets/egonav-indoor-draft/episode-005.mp4', 'rejected', 'Face anonymization failed — bystander visible in frame 00:41.');

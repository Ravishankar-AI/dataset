-- Manual seed script, mirroring prisma/seed.ts.
--
-- Exists because this workspace's sandbox can't open a raw Postgres
-- connection to Railway (only HTTPS is reachable here), so `npm run
-- db:seed` can't run from it. Paste this into Railway's Postgres service
-- → Database → Data query tab instead. If prisma/seed.ts ever changes,
-- this file needs updating by hand to match — it is not derived
-- automatically.
--
-- Every insert uses "on conflict ... do nothing" so this is safe to
-- re-run against a partially-seeded database (e.g. a real account
-- someone already registered with one of these demo emails, or a
-- previous attempt that got partway through before failing).
--
-- "passwordHash" below is scrypt("password123") via src/lib/password.ts's
-- hashPassword() — the same demo password prisma/seed.ts uses for every
-- seeded account.

insert into "Modality" (id, key, name, "sensorManifest", "sensorNote", "typicalUse") values
  ('mod_egocentric', 'egocentric', 'Egocentric', 'Camera + IMU', '+ LiDAR on supported rigs', 'First-person task and object-interaction data for imitation learning.'),
  ('mod_exocentric', 'exocentric', 'Exocentric', 'Fixed multi-camera', 'Synced 2-6 viewpoints', 'Third-person scene coverage for spatial reasoning and multi-view training.'),
  ('mod_teleop', 'teleop', 'Teleop', 'Arm joint states', '+ camera + operator input log', 'Operator-driven manipulation traces for policy training and action labeling.'),
  ('mod_umi_gripper', 'umi_gripper', 'UMI Gripper', 'Handheld gripper cam', '+ force/width sensing', 'In-the-wild grasp and manipulation capture without a fixed rig.'),
  ('mod_tactile', 'tactile', 'Tactile', 'Tactile array', '+ contact camera', 'Contact-rich manipulation data for grasp stability and slip detection.'),
  ('mod_mocap', 'mocap', 'MOCAP', 'Marker-based rig', '+ synced reference camera', 'Ground-truth kinematic trajectories for humanoid whole-body motion.')
on conflict (key) do nothing;

insert into "Organization" (id, name, slug) values
  ('org_acme_robotics', 'Acme Robotics', 'acme-robotics')
on conflict (slug) do nothing;

insert into "User" (id, email, name, "passwordHash", role, "organizationId") values
  ('usr_admin', 'ravi@objectways.com', 'Ravi', 'ddb9a3ef7236c9efb9fd6cfce827f6f8:be15eabf4496a552a5f6cf10eaaafbd259e36da5f52c0dc0a87043273f701d23ea34565cc6019e149735ab48fd76fdc4297bb29117b034ebf98f28aa1005ef8c', 'admin', null),
  ('usr_contributor', 'capture-team@objectways.com', 'Capture Team', 'ddb9a3ef7236c9efb9fd6cfce827f6f8:be15eabf4496a552a5f6cf10eaaafbd259e36da5f52c0dc0a87043273f701d23ea34565cc6019e149735ab48fd76fdc4297bb29117b034ebf98f28aa1005ef8c', 'contributor', null),
  ('usr_customer', 'ml-lead@acme-robotics.example', 'Acme ML Lead', 'ddb9a3ef7236c9efb9fd6cfce827f6f8:be15eabf4496a552a5f6cf10eaaafbd259e36da5f52c0dc0a87043273f701d23ea34565cc6019e149735ab48fd76fdc4297bb29117b034ebf98f28aa1005ef8c', 'customer', 'org_acme_robotics')
on conflict (email) do nothing;

-- Clutter Sort is real capture data confirmed via a live bucket listing
-- (LeRobot layout: data/meta/videos under chunk-000, 102 episodes, 3
-- cameras). Everything else in the bucket is unreviewed raw capture
-- staging, not fit for the catalog.
insert into "Dataset" (id, slug, title, description, "modalityId", "accessTier", status, version, "sizeBytes", "objectPrefix", chunk, cameras, fps, "robotType", "cameraModel", "updatedAt") values
  ('ds_clutter_sort', 'clutter-sort', 'Clutter Sort', 'Bimanual clutter-sorting manipulation episodes captured with a 3-camera rig (overhead plus both wrists).', 'mod_teleop', 'sample', 'published', 'v1', 580931773, 'Clutter_sort/', 'chunk-000', ARRAY['observation.images.cam_high','observation.images.cam_left_wrist','observation.images.cam_right_wrist'], 30, 'Trossen Robotics Mobile AI', 'Intel RealSense D405', now())
on conflict (slug) do nothing;

-- Corrects robotType/cameraModel on a row that was already seeded before
-- these were known/added -- on conflict do nothing above won't retroactively
-- fix an existing row, so this keeps re-running the file idempotent either way.
update "Dataset" set "robotType" = 'Trossen Robotics Mobile AI', "cameraModel" = 'Intel RealSense D405'
where slug = 'clutter-sort';

-- From Clutter_sort/meta/tasks.jsonl -- this dataset has exactly one task.
insert into "Task" (id, "datasetId", "taskIndex", title) values
  ('task_clutter_sort_0', 'ds_clutter_sort', 0, 'Picking a specific item from a clutter')
on conflict ("datasetId", "taskIndex") do nothing;

insert into "Dataset" (id, slug, title, description, "modalityId", "accessTier", status, version, "sizeBytes", "objectPrefix", "updatedAt") values
  ('ds_egograsp_acme_v2', 'egograsp-acme-v2', 'EgoGrasp — Acme Custom Capture', 'Custom EgoGrasp campaign scoped to Acme''s warehouse SKUs, 40 hours across 3 sites.', 'mod_egocentric', 'customer', 'published', 'v2', 1400000000000, 'datasets/egograsp-acme-v2/', now()),
  ('ds_egonav_indoor_draft', 'egonav-indoor-draft', 'EgoNav — Indoor Navigation (in review)', 'GPS-denied indoor navigation traces through malls, offices, and staircases.', 'mod_exocentric', 'customer', 'draft', 'v1', 0, 'datasets/egonav-indoor-draft/', now())
on conflict (slug) do nothing;

insert into "Entitlement" (id, "organizationId", "datasetId") values
  ('ent_acme_egograsp_v2', 'org_acme_robotics', 'ds_egograsp_acme_v2')
on conflict ("organizationId", "datasetId") do nothing;

insert into "Episode" (id, "datasetId", "taskId", "episodeIndex", "capturedAt", "durationSeconds", "sizeBytes", "objectKey", status, "rejectionReason") values
  ('ep_clutter_000', 'ds_clutter_sort', 'task_clutter_sort_0', 0, now() - interval '303 hours', 13, 4126488, 'Clutter_sort/data/chunk-000/episode_000000.parquet', 'cataloged', null),
  ('ep_clutter_001', 'ds_clutter_sort', 'task_clutter_sort_0', 1, now() - interval '300 hours', 12, 4127278, 'Clutter_sort/data/chunk-000/episode_000001.parquet', 'cataloged', null),
  ('ep_clutter_002', 'ds_clutter_sort', 'task_clutter_sort_0', 2, now() - interval '297 hours', 15, 5701571, 'Clutter_sort/data/chunk-000/episode_000002.parquet', 'cataloged', null),
  ('ep_clutter_003', 'ds_clutter_sort', 'task_clutter_sort_0', 3, now() - interval '294 hours', 11, 3938772, 'Clutter_sort/data/chunk-000/episode_000003.parquet', 'cataloged', null),
  ('ep_clutter_004', 'ds_clutter_sort', 'task_clutter_sort_0', 4, now() - interval '291 hours', 12, 4257283, 'Clutter_sort/data/chunk-000/episode_000004.parquet', 'cataloged', null),
  ('ep_clutter_005', 'ds_clutter_sort', 'task_clutter_sort_0', 5, now() - interval '288 hours', 17, 5691328, 'Clutter_sort/data/chunk-000/episode_000005.parquet', 'cataloged', null),
  ('ep_clutter_006', 'ds_clutter_sort', 'task_clutter_sort_0', 6, now() - interval '285 hours', 13, 4389753, 'Clutter_sort/data/chunk-000/episode_000006.parquet', 'cataloged', null),
  ('ep_clutter_007', 'ds_clutter_sort', 'task_clutter_sort_0', 7, now() - interval '282 hours', 12, 4788621, 'Clutter_sort/data/chunk-000/episode_000007.parquet', 'cataloged', null),
  ('ep_clutter_008', 'ds_clutter_sort', 'task_clutter_sort_0', 8, now() - interval '279 hours', 17, 6448855, 'Clutter_sort/data/chunk-000/episode_000008.parquet', 'cataloged', null),
  ('ep_clutter_009', 'ds_clutter_sort', 'task_clutter_sort_0', 9, now() - interval '276 hours', 16, 6136563, 'Clutter_sort/data/chunk-000/episode_000009.parquet', 'cataloged', null),
  ('ep_clutter_010', 'ds_clutter_sort', 'task_clutter_sort_0', 10, now() - interval '273 hours', 15, 5564866, 'Clutter_sort/data/chunk-000/episode_000010.parquet', 'cataloged', null),
  ('ep_clutter_011', 'ds_clutter_sort', 'task_clutter_sort_0', 11, now() - interval '270 hours', 16, 6610610, 'Clutter_sort/data/chunk-000/episode_000011.parquet', 'cataloged', null),
  ('ep_clutter_012', 'ds_clutter_sort', 'task_clutter_sort_0', 12, now() - interval '267 hours', 16, 6414489, 'Clutter_sort/data/chunk-000/episode_000012.parquet', 'cataloged', null),
  ('ep_clutter_013', 'ds_clutter_sort', 'task_clutter_sort_0', 13, now() - interval '264 hours', 17, 6402892, 'Clutter_sort/data/chunk-000/episode_000013.parquet', 'cataloged', null),
  ('ep_clutter_014', 'ds_clutter_sort', 'task_clutter_sort_0', 14, now() - interval '261 hours', 13, 5009817, 'Clutter_sort/data/chunk-000/episode_000014.parquet', 'cataloged', null),
  ('ep_clutter_015', 'ds_clutter_sort', 'task_clutter_sort_0', 15, now() - interval '258 hours', 15, 5898471, 'Clutter_sort/data/chunk-000/episode_000015.parquet', 'cataloged', null),
  ('ep_clutter_016', 'ds_clutter_sort', 'task_clutter_sort_0', 16, now() - interval '255 hours', 12, 4948301, 'Clutter_sort/data/chunk-000/episode_000016.parquet', 'cataloged', null),
  ('ep_clutter_017', 'ds_clutter_sort', 'task_clutter_sort_0', 17, now() - interval '252 hours', 14, 5601373, 'Clutter_sort/data/chunk-000/episode_000017.parquet', 'cataloged', null),
  ('ep_clutter_018', 'ds_clutter_sort', 'task_clutter_sort_0', 18, now() - interval '249 hours', 17, 6647726, 'Clutter_sort/data/chunk-000/episode_000018.parquet', 'cataloged', null),
  ('ep_clutter_019', 'ds_clutter_sort', 'task_clutter_sort_0', 19, now() - interval '246 hours', 15, 6340326, 'Clutter_sort/data/chunk-000/episode_000019.parquet', 'cataloged', null),
  ('ep_clutter_020', 'ds_clutter_sort', 'task_clutter_sort_0', 20, now() - interval '243 hours', 11, 4276418, 'Clutter_sort/data/chunk-000/episode_000020.parquet', 'cataloged', null),
  ('ep_clutter_021', 'ds_clutter_sort', 'task_clutter_sort_0', 21, now() - interval '240 hours', 15, 5789164, 'Clutter_sort/data/chunk-000/episode_000021.parquet', 'cataloged', null),
  ('ep_clutter_022', 'ds_clutter_sort', 'task_clutter_sort_0', 22, now() - interval '237 hours', 14, 6014457, 'Clutter_sort/data/chunk-000/episode_000022.parquet', 'cataloged', null),
  ('ep_clutter_023', 'ds_clutter_sort', 'task_clutter_sort_0', 23, now() - interval '234 hours', 17, 7190874, 'Clutter_sort/data/chunk-000/episode_000023.parquet', 'cataloged', null),
  ('ep_clutter_024', 'ds_clutter_sort', 'task_clutter_sort_0', 24, now() - interval '231 hours', 14, 6104775, 'Clutter_sort/data/chunk-000/episode_000024.parquet', 'cataloged', null),
  ('ep_clutter_025', 'ds_clutter_sort', 'task_clutter_sort_0', 25, now() - interval '228 hours', 13, 5673354, 'Clutter_sort/data/chunk-000/episode_000025.parquet', 'cataloged', null),
  ('ep_clutter_026', 'ds_clutter_sort', 'task_clutter_sort_0', 26, now() - interval '225 hours', 13, 5441581, 'Clutter_sort/data/chunk-000/episode_000026.parquet', 'cataloged', null),
  ('ep_clutter_027', 'ds_clutter_sort', 'task_clutter_sort_0', 27, now() - interval '222 hours', 19, 7732845, 'Clutter_sort/data/chunk-000/episode_000027.parquet', 'cataloged', null),
  ('ep_clutter_028', 'ds_clutter_sort', 'task_clutter_sort_0', 28, now() - interval '219 hours', 19, 8159516, 'Clutter_sort/data/chunk-000/episode_000028.parquet', 'cataloged', null),
  ('ep_clutter_029', 'ds_clutter_sort', 'task_clutter_sort_0', 29, now() - interval '216 hours', 16, 7004891, 'Clutter_sort/data/chunk-000/episode_000029.parquet', 'cataloged', null),
  ('ep_clutter_030', 'ds_clutter_sort', 'task_clutter_sort_0', 30, now() - interval '213 hours', 16, 6814772, 'Clutter_sort/data/chunk-000/episode_000030.parquet', 'cataloged', null),
  ('ep_clutter_031', 'ds_clutter_sort', 'task_clutter_sort_0', 31, now() - interval '210 hours', 13, 5030684, 'Clutter_sort/data/chunk-000/episode_000031.parquet', 'cataloged', null),
  ('ep_clutter_032', 'ds_clutter_sort', 'task_clutter_sort_0', 32, now() - interval '207 hours', 17, 6947309, 'Clutter_sort/data/chunk-000/episode_000032.parquet', 'cataloged', null),
  ('ep_clutter_033', 'ds_clutter_sort', 'task_clutter_sort_0', 33, now() - interval '204 hours', 17, 6703262, 'Clutter_sort/data/chunk-000/episode_000033.parquet', 'cataloged', null),
  ('ep_clutter_034', 'ds_clutter_sort', 'task_clutter_sort_0', 34, now() - interval '201 hours', 15, 6066914, 'Clutter_sort/data/chunk-000/episode_000034.parquet', 'cataloged', null),
  ('ep_clutter_035', 'ds_clutter_sort', 'task_clutter_sort_0', 35, now() - interval '198 hours', 15, 6153607, 'Clutter_sort/data/chunk-000/episode_000035.parquet', 'cataloged', null),
  ('ep_clutter_036', 'ds_clutter_sort', 'task_clutter_sort_0', 36, now() - interval '195 hours', 15, 5964280, 'Clutter_sort/data/chunk-000/episode_000036.parquet', 'cataloged', null),
  ('ep_clutter_037', 'ds_clutter_sort', 'task_clutter_sort_0', 37, now() - interval '192 hours', 15, 6053317, 'Clutter_sort/data/chunk-000/episode_000037.parquet', 'cataloged', null),
  ('ep_clutter_038', 'ds_clutter_sort', 'task_clutter_sort_0', 38, now() - interval '189 hours', 20, 7554827, 'Clutter_sort/data/chunk-000/episode_000038.parquet', 'cataloged', null),
  ('ep_clutter_039', 'ds_clutter_sort', 'task_clutter_sort_0', 39, now() - interval '186 hours', 16, 6098922, 'Clutter_sort/data/chunk-000/episode_000039.parquet', 'cataloged', null),
  ('ep_clutter_040', 'ds_clutter_sort', 'task_clutter_sort_0', 40, now() - interval '183 hours', 18, 7114978, 'Clutter_sort/data/chunk-000/episode_000040.parquet', 'cataloged', null),
  ('ep_clutter_041', 'ds_clutter_sort', 'task_clutter_sort_0', 41, now() - interval '180 hours', 15, 6084126, 'Clutter_sort/data/chunk-000/episode_000041.parquet', 'cataloged', null),
  ('ep_clutter_042', 'ds_clutter_sort', 'task_clutter_sort_0', 42, now() - interval '177 hours', 12, 5223584, 'Clutter_sort/data/chunk-000/episode_000042.parquet', 'cataloged', null),
  ('ep_clutter_043', 'ds_clutter_sort', 'task_clutter_sort_0', 43, now() - interval '174 hours', 16, 7507504, 'Clutter_sort/data/chunk-000/episode_000043.parquet', 'cataloged', null),
  ('ep_clutter_044', 'ds_clutter_sort', 'task_clutter_sort_0', 44, now() - interval '171 hours', 11, 4272181, 'Clutter_sort/data/chunk-000/episode_000044.parquet', 'cataloged', null),
  ('ep_clutter_045', 'ds_clutter_sort', 'task_clutter_sort_0', 45, now() - interval '168 hours', 15, 5712872, 'Clutter_sort/data/chunk-000/episode_000045.parquet', 'cataloged', null),
  ('ep_clutter_046', 'ds_clutter_sort', 'task_clutter_sort_0', 46, now() - interval '165 hours', 13, 5690751, 'Clutter_sort/data/chunk-000/episode_000046.parquet', 'cataloged', null),
  ('ep_clutter_047', 'ds_clutter_sort', 'task_clutter_sort_0', 47, now() - interval '162 hours', 18, 7387484, 'Clutter_sort/data/chunk-000/episode_000047.parquet', 'cataloged', null),
  ('ep_clutter_048', 'ds_clutter_sort', 'task_clutter_sort_0', 48, now() - interval '159 hours', 13, 4998910, 'Clutter_sort/data/chunk-000/episode_000048.parquet', 'cataloged', null),
  ('ep_clutter_049', 'ds_clutter_sort', 'task_clutter_sort_0', 49, now() - interval '156 hours', 14, 5629851, 'Clutter_sort/data/chunk-000/episode_000049.parquet', 'cataloged', null),
  ('ep_clutter_050', 'ds_clutter_sort', 'task_clutter_sort_0', 50, now() - interval '153 hours', 14, 6132416, 'Clutter_sort/data/chunk-000/episode_000050.parquet', 'cataloged', null),
  ('ep_clutter_051', 'ds_clutter_sort', 'task_clutter_sort_0', 51, now() - interval '150 hours', 13, 5118277, 'Clutter_sort/data/chunk-000/episode_000051.parquet', 'cataloged', null),
  ('ep_clutter_052', 'ds_clutter_sort', 'task_clutter_sort_0', 52, now() - interval '147 hours', 13, 4626853, 'Clutter_sort/data/chunk-000/episode_000052.parquet', 'cataloged', null),
  ('ep_clutter_053', 'ds_clutter_sort', 'task_clutter_sort_0', 53, now() - interval '144 hours', 14, 5245594, 'Clutter_sort/data/chunk-000/episode_000053.parquet', 'cataloged', null),
  ('ep_clutter_054', 'ds_clutter_sort', 'task_clutter_sort_0', 54, now() - interval '141 hours', 15, 6427039, 'Clutter_sort/data/chunk-000/episode_000054.parquet', 'cataloged', null),
  ('ep_clutter_055', 'ds_clutter_sort', 'task_clutter_sort_0', 55, now() - interval '138 hours', 15, 5891437, 'Clutter_sort/data/chunk-000/episode_000055.parquet', 'cataloged', null),
  ('ep_clutter_056', 'ds_clutter_sort', 'task_clutter_sort_0', 56, now() - interval '135 hours', 10, 3506122, 'Clutter_sort/data/chunk-000/episode_000056.parquet', 'cataloged', null),
  ('ep_clutter_057', 'ds_clutter_sort', 'task_clutter_sort_0', 57, now() - interval '132 hours', 13, 5284234, 'Clutter_sort/data/chunk-000/episode_000057.parquet', 'cataloged', null),
  ('ep_clutter_058', 'ds_clutter_sort', 'task_clutter_sort_0', 58, now() - interval '129 hours', 16, 5822146, 'Clutter_sort/data/chunk-000/episode_000058.parquet', 'cataloged', null),
  ('ep_clutter_059', 'ds_clutter_sort', 'task_clutter_sort_0', 59, now() - interval '126 hours', 11, 4340765, 'Clutter_sort/data/chunk-000/episode_000059.parquet', 'cataloged', null),
  ('ep_clutter_060', 'ds_clutter_sort', 'task_clutter_sort_0', 60, now() - interval '123 hours', 11, 3914955, 'Clutter_sort/data/chunk-000/episode_000060.parquet', 'cataloged', null),
  ('ep_clutter_061', 'ds_clutter_sort', 'task_clutter_sort_0', 61, now() - interval '120 hours', 10, 4011852, 'Clutter_sort/data/chunk-000/episode_000061.parquet', 'cataloged', null),
  ('ep_clutter_062', 'ds_clutter_sort', 'task_clutter_sort_0', 62, now() - interval '117 hours', 13, 5148248, 'Clutter_sort/data/chunk-000/episode_000062.parquet', 'cataloged', null),
  ('ep_clutter_063', 'ds_clutter_sort', 'task_clutter_sort_0', 63, now() - interval '114 hours', 15, 6182782, 'Clutter_sort/data/chunk-000/episode_000063.parquet', 'cataloged', null),
  ('ep_clutter_064', 'ds_clutter_sort', 'task_clutter_sort_0', 64, now() - interval '111 hours', 12, 4843399, 'Clutter_sort/data/chunk-000/episode_000064.parquet', 'cataloged', null),
  ('ep_clutter_065', 'ds_clutter_sort', 'task_clutter_sort_0', 65, now() - interval '108 hours', 17, 6224669, 'Clutter_sort/data/chunk-000/episode_000065.parquet', 'cataloged', null),
  ('ep_clutter_066', 'ds_clutter_sort', 'task_clutter_sort_0', 66, now() - interval '105 hours', 13, 5053996, 'Clutter_sort/data/chunk-000/episode_000066.parquet', 'cataloged', null),
  ('ep_clutter_067', 'ds_clutter_sort', 'task_clutter_sort_0', 67, now() - interval '102 hours', 13, 5163348, 'Clutter_sort/data/chunk-000/episode_000067.parquet', 'cataloged', null),
  ('ep_clutter_068', 'ds_clutter_sort', 'task_clutter_sort_0', 68, now() - interval '99 hours', 13, 5303355, 'Clutter_sort/data/chunk-000/episode_000068.parquet', 'cataloged', null),
  ('ep_clutter_069', 'ds_clutter_sort', 'task_clutter_sort_0', 69, now() - interval '96 hours', 11, 4447908, 'Clutter_sort/data/chunk-000/episode_000069.parquet', 'cataloged', null),
  ('ep_clutter_070', 'ds_clutter_sort', 'task_clutter_sort_0', 70, now() - interval '93 hours', 11, 4278646, 'Clutter_sort/data/chunk-000/episode_000070.parquet', 'cataloged', null),
  ('ep_clutter_071', 'ds_clutter_sort', 'task_clutter_sort_0', 71, now() - interval '90 hours', 10, 4316586, 'Clutter_sort/data/chunk-000/episode_000071.parquet', 'cataloged', null),
  ('ep_clutter_072', 'ds_clutter_sort', 'task_clutter_sort_0', 72, now() - interval '87 hours', 11, 4540070, 'Clutter_sort/data/chunk-000/episode_000072.parquet', 'cataloged', null),
  ('ep_clutter_073', 'ds_clutter_sort', 'task_clutter_sort_0', 73, now() - interval '84 hours', 14, 6741188, 'Clutter_sort/data/chunk-000/episode_000073.parquet', 'cataloged', null),
  ('ep_clutter_074', 'ds_clutter_sort', 'task_clutter_sort_0', 74, now() - interval '81 hours', 16, 7993851, 'Clutter_sort/data/chunk-000/episode_000074.parquet', 'cataloged', null),
  ('ep_clutter_075', 'ds_clutter_sort', 'task_clutter_sort_0', 75, now() - interval '78 hours', 12, 5476037, 'Clutter_sort/data/chunk-000/episode_000075.parquet', 'cataloged', null),
  ('ep_clutter_076', 'ds_clutter_sort', 'task_clutter_sort_0', 76, now() - interval '75 hours', 14, 7033735, 'Clutter_sort/data/chunk-000/episode_000076.parquet', 'cataloged', null),
  ('ep_clutter_077', 'ds_clutter_sort', 'task_clutter_sort_0', 77, now() - interval '72 hours', 13, 5713605, 'Clutter_sort/data/chunk-000/episode_000077.parquet', 'cataloged', null),
  ('ep_clutter_078', 'ds_clutter_sort', 'task_clutter_sort_0', 78, now() - interval '69 hours', 16, 7451691, 'Clutter_sort/data/chunk-000/episode_000078.parquet', 'cataloged', null),
  ('ep_clutter_079', 'ds_clutter_sort', 'task_clutter_sort_0', 79, now() - interval '66 hours', 13, 6204658, 'Clutter_sort/data/chunk-000/episode_000079.parquet', 'cataloged', null),
  ('ep_clutter_080', 'ds_clutter_sort', 'task_clutter_sort_0', 80, now() - interval '63 hours', 15, 7095753, 'Clutter_sort/data/chunk-000/episode_000080.parquet', 'cataloged', null),
  ('ep_clutter_081', 'ds_clutter_sort', 'task_clutter_sort_0', 81, now() - interval '60 hours', 13, 6208821, 'Clutter_sort/data/chunk-000/episode_000081.parquet', 'cataloged', null),
  ('ep_clutter_082', 'ds_clutter_sort', 'task_clutter_sort_0', 82, now() - interval '57 hours', 10, 4080074, 'Clutter_sort/data/chunk-000/episode_000082.parquet', 'cataloged', null),
  ('ep_clutter_083', 'ds_clutter_sort', 'task_clutter_sort_0', 83, now() - interval '54 hours', 13, 5287480, 'Clutter_sort/data/chunk-000/episode_000083.parquet', 'cataloged', null),
  ('ep_clutter_084', 'ds_clutter_sort', 'task_clutter_sort_0', 84, now() - interval '51 hours', 13, 5190817, 'Clutter_sort/data/chunk-000/episode_000084.parquet', 'cataloged', null),
  ('ep_clutter_085', 'ds_clutter_sort', 'task_clutter_sort_0', 85, now() - interval '48 hours', 13, 5238301, 'Clutter_sort/data/chunk-000/episode_000085.parquet', 'cataloged', null),
  ('ep_clutter_086', 'ds_clutter_sort', 'task_clutter_sort_0', 86, now() - interval '45 hours', 16, 7938553, 'Clutter_sort/data/chunk-000/episode_000086.parquet', 'cataloged', null),
  ('ep_clutter_087', 'ds_clutter_sort', 'task_clutter_sort_0', 87, now() - interval '42 hours', 13, 5191818, 'Clutter_sort/data/chunk-000/episode_000087.parquet', 'cataloged', null),
  ('ep_clutter_088', 'ds_clutter_sort', 'task_clutter_sort_0', 88, now() - interval '39 hours', 13, 5195990, 'Clutter_sort/data/chunk-000/episode_000088.parquet', 'cataloged', null),
  ('ep_clutter_089', 'ds_clutter_sort', 'task_clutter_sort_0', 89, now() - interval '36 hours', 12, 4793644, 'Clutter_sort/data/chunk-000/episode_000089.parquet', 'cataloged', null),
  ('ep_clutter_090', 'ds_clutter_sort', 'task_clutter_sort_0', 90, now() - interval '33 hours', 14, 5635218, 'Clutter_sort/data/chunk-000/episode_000090.parquet', 'cataloged', null),
  ('ep_clutter_091', 'ds_clutter_sort', 'task_clutter_sort_0', 91, now() - interval '30 hours', 14, 5976624, 'Clutter_sort/data/chunk-000/episode_000091.parquet', 'cataloged', null),
  ('ep_clutter_092', 'ds_clutter_sort', 'task_clutter_sort_0', 92, now() - interval '27 hours', 11, 4697085, 'Clutter_sort/data/chunk-000/episode_000092.parquet', 'cataloged', null),
  ('ep_clutter_093', 'ds_clutter_sort', 'task_clutter_sort_0', 93, now() - interval '24 hours', 11, 4636667, 'Clutter_sort/data/chunk-000/episode_000093.parquet', 'cataloged', null),
  ('ep_clutter_094', 'ds_clutter_sort', 'task_clutter_sort_0', 94, now() - interval '21 hours', 12, 5577075, 'Clutter_sort/data/chunk-000/episode_000094.parquet', 'cataloged', null),
  ('ep_clutter_095', 'ds_clutter_sort', 'task_clutter_sort_0', 95, now() - interval '18 hours', 11, 5262354, 'Clutter_sort/data/chunk-000/episode_000095.parquet', 'cataloged', null),
  ('ep_clutter_096', 'ds_clutter_sort', 'task_clutter_sort_0', 96, now() - interval '15 hours', 11, 5129803, 'Clutter_sort/data/chunk-000/episode_000096.parquet', 'cataloged', null),
  ('ep_clutter_097', 'ds_clutter_sort', 'task_clutter_sort_0', 97, now() - interval '12 hours', 12, 5517012, 'Clutter_sort/data/chunk-000/episode_000097.parquet', 'cataloged', null),
  ('ep_clutter_098', 'ds_clutter_sort', 'task_clutter_sort_0', 98, now() - interval '9 hours', 14, 6691967, 'Clutter_sort/data/chunk-000/episode_000098.parquet', 'cataloged', null),
  ('ep_clutter_099', 'ds_clutter_sort', 'task_clutter_sort_0', 99, now() - interval '6 hours', 15, 6919115, 'Clutter_sort/data/chunk-000/episode_000099.parquet', 'cataloged', null),
  ('ep_clutter_100', 'ds_clutter_sort', 'task_clutter_sort_0', 100, now() - interval '3 hours', 11, 4311477, 'Clutter_sort/data/chunk-000/episode_000100.parquet', 'cataloged', null),
  ('ep_clutter_101', 'ds_clutter_sort', 'task_clutter_sort_0', 101, now() - interval '0 hours', 14, 6046464, 'Clutter_sort/data/chunk-000/episode_000101.parquet', 'cataloged', null)
on conflict (id) do nothing;

insert into "Episode" (id, "datasetId", "capturedAt", "durationSeconds", "sizeBytes", "objectKey", status, "rejectionReason") values
  ('ep_001', 'ds_egonav_indoor_draft', now() - interval '2 hours', 340, 80000000, 'datasets/egonav-indoor-draft/episode-001.mp4', 'cataloged', null),
  ('ep_002', 'ds_egonav_indoor_draft', now() - interval '5 hours', 512, 92000000, 'datasets/egonav-indoor-draft/episode-002.mp4', 'cataloged', null),
  ('ep_003', 'ds_egonav_indoor_draft', now() - interval '1 hours', 280, 104000000, 'datasets/egonav-indoor-draft/episode-003.mp4', 'validating', null),
  ('ep_004', 'ds_egonav_indoor_draft', now() - interval '0.2 hours', 190, 116000000, 'datasets/egonav-indoor-draft/episode-004.mp4', 'queued', null),
  ('ep_005', 'ds_egonav_indoor_draft', now() - interval '8 hours', 95, 128000000, 'datasets/egonav-indoor-draft/episode-005.mp4', 'rejected', 'Face anonymization failed — bystander visible in frame 00:41.')
on conflict (id) do nothing;

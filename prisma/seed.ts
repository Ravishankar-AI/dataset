import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { episodeParquetKey } from "../src/lib/lerobot";
import teleopTasks from "./data/teleop-tasks.json";

const prisma = new PrismaClient();

// Real per-episode data from Clutter_sort/meta/episodes.jsonl (durationSeconds
// = frame length / 30fps, rounded) cross-referenced with real per-episode
// byte sizes from a live bucket listing (parquet + all 3 camera videos).
const CLUTTER_SORT_EPISODES = [
  { episodeIndex: 0, durationSeconds: 13, sizeBytes: 4126488 },
  { episodeIndex: 1, durationSeconds: 12, sizeBytes: 4127278 },
  { episodeIndex: 2, durationSeconds: 15, sizeBytes: 5701571 },
  { episodeIndex: 3, durationSeconds: 11, sizeBytes: 3938772 },
  { episodeIndex: 4, durationSeconds: 12, sizeBytes: 4257283 },
  { episodeIndex: 5, durationSeconds: 17, sizeBytes: 5691328 },
  { episodeIndex: 6, durationSeconds: 13, sizeBytes: 4389753 },
  { episodeIndex: 7, durationSeconds: 12, sizeBytes: 4788621 },
  { episodeIndex: 8, durationSeconds: 17, sizeBytes: 6448855 },
  { episodeIndex: 9, durationSeconds: 16, sizeBytes: 6136563 },
  { episodeIndex: 10, durationSeconds: 15, sizeBytes: 5564866 },
  { episodeIndex: 11, durationSeconds: 16, sizeBytes: 6610610 },
  { episodeIndex: 12, durationSeconds: 16, sizeBytes: 6414489 },
  { episodeIndex: 13, durationSeconds: 17, sizeBytes: 6402892 },
  { episodeIndex: 14, durationSeconds: 13, sizeBytes: 5009817 },
  { episodeIndex: 15, durationSeconds: 15, sizeBytes: 5898471 },
  { episodeIndex: 16, durationSeconds: 12, sizeBytes: 4948301 },
  { episodeIndex: 17, durationSeconds: 14, sizeBytes: 5601373 },
  { episodeIndex: 18, durationSeconds: 17, sizeBytes: 6647726 },
  { episodeIndex: 19, durationSeconds: 15, sizeBytes: 6340326 },
  { episodeIndex: 20, durationSeconds: 11, sizeBytes: 4276418 },
  { episodeIndex: 21, durationSeconds: 15, sizeBytes: 5789164 },
  { episodeIndex: 22, durationSeconds: 14, sizeBytes: 6014457 },
  { episodeIndex: 23, durationSeconds: 17, sizeBytes: 7190874 },
  { episodeIndex: 24, durationSeconds: 14, sizeBytes: 6104775 },
  { episodeIndex: 25, durationSeconds: 13, sizeBytes: 5673354 },
  { episodeIndex: 26, durationSeconds: 13, sizeBytes: 5441581 },
  { episodeIndex: 27, durationSeconds: 19, sizeBytes: 7732845 },
  { episodeIndex: 28, durationSeconds: 19, sizeBytes: 8159516 },
  { episodeIndex: 29, durationSeconds: 16, sizeBytes: 7004891 },
  { episodeIndex: 30, durationSeconds: 16, sizeBytes: 6814772 },
  { episodeIndex: 31, durationSeconds: 13, sizeBytes: 5030684 },
  { episodeIndex: 32, durationSeconds: 17, sizeBytes: 6947309 },
  { episodeIndex: 33, durationSeconds: 17, sizeBytes: 6703262 },
  { episodeIndex: 34, durationSeconds: 15, sizeBytes: 6066914 },
  { episodeIndex: 35, durationSeconds: 15, sizeBytes: 6153607 },
  { episodeIndex: 36, durationSeconds: 15, sizeBytes: 5964280 },
  { episodeIndex: 37, durationSeconds: 15, sizeBytes: 6053317 },
  { episodeIndex: 38, durationSeconds: 20, sizeBytes: 7554827 },
  { episodeIndex: 39, durationSeconds: 16, sizeBytes: 6098922 },
  { episodeIndex: 40, durationSeconds: 18, sizeBytes: 7114978 },
  { episodeIndex: 41, durationSeconds: 15, sizeBytes: 6084126 },
  { episodeIndex: 42, durationSeconds: 12, sizeBytes: 5223584 },
  { episodeIndex: 43, durationSeconds: 16, sizeBytes: 7507504 },
  { episodeIndex: 44, durationSeconds: 11, sizeBytes: 4272181 },
  { episodeIndex: 45, durationSeconds: 15, sizeBytes: 5712872 },
  { episodeIndex: 46, durationSeconds: 13, sizeBytes: 5690751 },
  { episodeIndex: 47, durationSeconds: 18, sizeBytes: 7387484 },
  { episodeIndex: 48, durationSeconds: 13, sizeBytes: 4998910 },
  { episodeIndex: 49, durationSeconds: 14, sizeBytes: 5629851 },
  { episodeIndex: 50, durationSeconds: 14, sizeBytes: 6132416 },
  { episodeIndex: 51, durationSeconds: 13, sizeBytes: 5118277 },
  { episodeIndex: 52, durationSeconds: 13, sizeBytes: 4626853 },
  { episodeIndex: 53, durationSeconds: 14, sizeBytes: 5245594 },
  { episodeIndex: 54, durationSeconds: 15, sizeBytes: 6427039 },
  { episodeIndex: 55, durationSeconds: 15, sizeBytes: 5891437 },
  { episodeIndex: 56, durationSeconds: 10, sizeBytes: 3506122 },
  { episodeIndex: 57, durationSeconds: 13, sizeBytes: 5284234 },
  { episodeIndex: 58, durationSeconds: 16, sizeBytes: 5822146 },
  { episodeIndex: 59, durationSeconds: 11, sizeBytes: 4340765 },
  { episodeIndex: 60, durationSeconds: 11, sizeBytes: 3914955 },
  { episodeIndex: 61, durationSeconds: 10, sizeBytes: 4011852 },
  { episodeIndex: 62, durationSeconds: 13, sizeBytes: 5148248 },
  { episodeIndex: 63, durationSeconds: 15, sizeBytes: 6182782 },
  { episodeIndex: 64, durationSeconds: 12, sizeBytes: 4843399 },
  { episodeIndex: 65, durationSeconds: 17, sizeBytes: 6224669 },
  { episodeIndex: 66, durationSeconds: 13, sizeBytes: 5053996 },
  { episodeIndex: 67, durationSeconds: 13, sizeBytes: 5163348 },
  { episodeIndex: 68, durationSeconds: 13, sizeBytes: 5303355 },
  { episodeIndex: 69, durationSeconds: 11, sizeBytes: 4447908 },
  { episodeIndex: 70, durationSeconds: 11, sizeBytes: 4278646 },
  { episodeIndex: 71, durationSeconds: 10, sizeBytes: 4316586 },
  { episodeIndex: 72, durationSeconds: 11, sizeBytes: 4540070 },
  { episodeIndex: 73, durationSeconds: 14, sizeBytes: 6741188 },
  { episodeIndex: 74, durationSeconds: 16, sizeBytes: 7993851 },
  { episodeIndex: 75, durationSeconds: 12, sizeBytes: 5476037 },
  { episodeIndex: 76, durationSeconds: 14, sizeBytes: 7033735 },
  { episodeIndex: 77, durationSeconds: 13, sizeBytes: 5713605 },
  { episodeIndex: 78, durationSeconds: 16, sizeBytes: 7451691 },
  { episodeIndex: 79, durationSeconds: 13, sizeBytes: 6204658 },
  { episodeIndex: 80, durationSeconds: 15, sizeBytes: 7095753 },
  { episodeIndex: 81, durationSeconds: 13, sizeBytes: 6208821 },
  { episodeIndex: 82, durationSeconds: 10, sizeBytes: 4080074 },
  { episodeIndex: 83, durationSeconds: 13, sizeBytes: 5287480 },
  { episodeIndex: 84, durationSeconds: 13, sizeBytes: 5190817 },
  { episodeIndex: 85, durationSeconds: 13, sizeBytes: 5238301 },
  { episodeIndex: 86, durationSeconds: 16, sizeBytes: 7938553 },
  { episodeIndex: 87, durationSeconds: 13, sizeBytes: 5191818 },
  { episodeIndex: 88, durationSeconds: 13, sizeBytes: 5195990 },
  { episodeIndex: 89, durationSeconds: 12, sizeBytes: 4793644 },
  { episodeIndex: 90, durationSeconds: 14, sizeBytes: 5635218 },
  { episodeIndex: 91, durationSeconds: 14, sizeBytes: 5976624 },
  { episodeIndex: 92, durationSeconds: 11, sizeBytes: 4697085 },
  { episodeIndex: 93, durationSeconds: 11, sizeBytes: 4636667 },
  { episodeIndex: 94, durationSeconds: 12, sizeBytes: 5577075 },
  { episodeIndex: 95, durationSeconds: 11, sizeBytes: 5262354 },
  { episodeIndex: 96, durationSeconds: 11, sizeBytes: 5129803 },
  { episodeIndex: 97, durationSeconds: 12, sizeBytes: 5517012 },
  { episodeIndex: 98, durationSeconds: 14, sizeBytes: 6691967 },
  { episodeIndex: 99, durationSeconds: 15, sizeBytes: 6919115 },
  { episodeIndex: 100, durationSeconds: 11, sizeBytes: 4311477 },
  { episodeIndex: 101, durationSeconds: 14, sizeBytes: 6046464 },
];

// Demo password for every seeded account below — dev/demo only.
const DEMO_PASSWORD = "password123";

const MODALITIES = [
  {
    key: "egocentric",
    name: "Egocentric",
    sensorManifest: "Camera + IMU",
    sensorNote: "+ LiDAR on supported rigs",
    typicalUse: "First-person task and object-interaction data for imitation learning.",
  },
  {
    key: "exocentric",
    name: "Exocentric",
    sensorManifest: "Fixed multi-camera",
    sensorNote: "Synced 2-6 viewpoints",
    typicalUse: "Third-person scene coverage for spatial reasoning and multi-view training.",
  },
  {
    key: "teleop",
    name: "Teleop",
    sensorManifest: "Arm joint states",
    sensorNote: "+ camera + operator input log",
    typicalUse: "Operator-driven manipulation traces for policy training and action labeling.",
  },
  {
    key: "umi_gripper",
    name: "UMI Gripper",
    sensorManifest: "Handheld gripper cam",
    sensorNote: "+ force/width sensing",
    typicalUse: "In-the-wild grasp and manipulation capture without a fixed rig.",
  },
  {
    key: "tactile",
    name: "Tactile",
    sensorManifest: "Tactile array",
    sensorNote: "+ contact camera",
    typicalUse: "Contact-rich manipulation data for grasp stability and slip detection.",
  },
  {
    key: "mocap",
    name: "MOCAP",
    sensorManifest: "Marker-based rig",
    sensorNote: "+ synced reference camera",
    typicalUse: "Ground-truth kinematic trajectories for humanoid whole-body motion.",
  },
];

async function main() {
  console.log("Seeding...");

  await prisma.entitlement.deleteMany();
  await prisma.episode.deleteMany();
  await prisma.task.deleteMany();
  await prisma.dataset.deleteMany();
  await prisma.modality.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const modalities = new Map<string, string>();
  for (const m of MODALITIES) {
    const created = await prisma.modality.create({ data: m });
    modalities.set(m.key, created.id);
  }

  const acme = await prisma.organization.create({
    data: { name: "Acme Robotics", slug: "acme-robotics" },
  });

  const demoPasswordHash = hashPassword(DEMO_PASSWORD);

  await prisma.user.createMany({
    data: [
      {
        email: "ravi@objectways.com",
        name: "Ravi",
        role: "admin",
        passwordHash: demoPasswordHash,
      },
      {
        email: "capture-team@objectways.com",
        name: "Capture Team",
        role: "contributor",
        passwordHash: demoPasswordHash,
      },
      {
        email: "ml-lead@acme-robotics.example",
        name: "Acme ML Lead",
        role: "customer",
        organizationId: acme.id,
        passwordHash: demoPasswordHash,
      },
    ],
  });

  // Real capture from the teleoperation bucket (LeRobot layout: data/meta/videos
  // under chunk-000, 102 episodes, 3 wrist/overhead cameras) — confirmed via a
  // live bucket listing. The rest of that bucket's raw capture folders are
  // seeded further down as the "Bimanual Robot Manipulation Dataset" multi-task dataset,
  // which also covers this same folder (as one of its 497 tasks) -- so this
  // standalone entry stays unpublished rather than showing twice on Samples.
  const clutterSort = await prisma.dataset.create({
    data: {
      slug: "clutter-sort",
      title: "Clutter Sort",
      description:
        "Bimanual clutter-sorting manipulation episodes captured with a 3-camera rig (overhead plus both wrists).",
      modalityId: modalities.get("teleop")!,
      accessTier: "sample",
      status: "draft",
      version: "v1",
      sizeBytes: BigInt(580_931_773),
      objectPrefix: "Clutter_sort/",
      chunk: "chunk-000",
      fps: 30,
      robotType: "Trossen Robotics Mobile AI",
      cameraModel: "Intel RealSense D405",
      cameras: [
        "observation.images.cam_high",
        "observation.images.cam_left_wrist",
        "observation.images.cam_right_wrist",
      ],
    },
  });

  // From Clutter_sort/meta/tasks.jsonl -- this dataset has exactly one task.
  const clutterSortTask = await prisma.task.create({
    data: {
      datasetId: clutterSort.id,
      taskIndex: 0,
      title: "Picking a specific item from a clutter",
      objectPrefix: clutterSort.objectPrefix,
      chunk: clutterSort.chunk,
      cameras: clutterSort.cameras,
    },
  });

  const clutterSortNow = new Date();
  for (const e of CLUTTER_SORT_EPISODES) {
    await prisma.episode.create({
      data: {
        datasetId: clutterSort.id,
        taskId: clutterSortTask.id,
        episodeIndex: e.episodeIndex,
        capturedAt: new Date(
          clutterSortNow.getTime() - (101 - e.episodeIndex) * 3 * 3600_000
        ),
        durationSeconds: e.durationSeconds,
        sizeBytes: BigInt(e.sizeBytes),
        objectKey: episodeParquetKey(clutterSort, e.episodeIndex),
        status: "cataloged",
      },
    });
  }

  // The other ~497 raw capture folders in the bucket -- imported as-is
  // (duplicates, typos, test uploads and all) as one task per folder under
  // a single umbrella dataset. Each folder is its own LeRobot capture with
  // its own object prefix and camera set, hence objectPrefix/chunk/cameras
  // living on Task rather than Dataset here. Per-episode duration/size are
  // folder-level averages (total_frames/fps/total_episodes,
  // total_bytes/total_episodes) rather than exact per-episode data, capped
  // at 10 sample deliverables per task -- real episode files exist at every
  // sampled index, just with an averaged (not exact) duration/size shown.
  const teleopTotalBytes = teleopTasks.reduce((sum, t) => sum + t.totalBytes, 0);

  const teleopTitle = "Bimanual Robot Manipulation Dataset";
  const teleopDescription =
    "Raw teleoperation capture sessions from the bucket's staging folders, one task per capture folder. Imported as-is, duplicates included.";

  const teleopCapture = await prisma.dataset.upsert({
    where: { slug: "teleoperation-capture" },
    update: { title: teleopTitle, description: teleopDescription },
    create: {
      slug: "teleoperation-capture",
      title: teleopTitle,
      description: teleopDescription,
      modalityId: modalities.get("teleop")!,
      accessTier: "sample",
      status: "published",
      version: "v1",
      sizeBytes: BigInt(teleopTotalBytes),
      // Not meaningful at the dataset level here -- every task has its own
      // objectPrefix/chunk/cameras (see Task.objectPrefix docs).
      objectPrefix: "",
      fps: 30,
      robotType: "Trossen Robotics Mobile AI",
      cameraModel: "Intel RealSense D405",
    },
  });

  const teleopNow = new Date();
  for (const t of teleopTasks) {
    const task = await prisma.task.upsert({
      where: { datasetId_taskIndex: { datasetId: teleopCapture.id, taskIndex: t.taskIndex } },
      update: {},
      create: {
        datasetId: teleopCapture.id,
        taskIndex: t.taskIndex,
        title: t.title,
        objectPrefix: t.objectPrefix,
        chunk: t.chunk,
        cameras: t.cameras,
      },
    });

    for (let episodeIndex = 0; episodeIndex < t.sampleCount; episodeIndex++) {
      await prisma.episode.upsert({
        where: { taskId_episodeIndex: { taskId: task.id, episodeIndex } },
        update: {},
        create: {
          datasetId: teleopCapture.id,
          taskId: task.id,
          episodeIndex,
          capturedAt: new Date(teleopNow.getTime() - (t.taskIndex * 10 + episodeIndex) * 3600_000),
          durationSeconds: t.avgDurationSeconds,
          sizeBytes: BigInt(t.avgSizeBytes),
          objectKey: episodeParquetKey(task, episodeIndex),
          status: "cataloged",
        },
      });
    }
  }

  const acmeDataset = await prisma.dataset.create({
    data: {
      slug: "egograsp-acme-v2",
      title: "EgoGrasp — Acme Custom Capture",
      description: "Custom EgoGrasp campaign scoped to Acme's warehouse SKUs, 40 hours across 3 sites.",
      modalityId: modalities.get("egocentric")!,
      accessTier: "customer",
      status: "published",
      version: "v2",
      sizeBytes: BigInt(1_400_000_000_000),
      objectPrefix: "datasets/egograsp-acme-v2/",
      priceLabel: "$18,000",
    },
  });

  await prisma.entitlement.create({
    data: { organizationId: acme.id, datasetId: acmeDataset.id },
  });

  const draftDataset = await prisma.dataset.create({
    data: {
      slug: "egonav-indoor-draft",
      title: "EgoNav — Indoor Navigation (in review)",
      description: "GPS-denied indoor navigation traces through malls, offices, and staircases.",
      modalityId: modalities.get("exocentric")!,
      accessTier: "customer",
      status: "draft",
      version: "v1",
      sizeBytes: BigInt(0),
      objectPrefix: "datasets/egonav-indoor-draft/",
    },
  });

  const now = new Date();
  const episodeSeeds = [
    { status: "cataloged", offsetHours: 2, duration: 340 },
    { status: "cataloged", offsetHours: 5, duration: 512 },
    { status: "validating", offsetHours: 1, duration: 280 },
    { status: "queued", offsetHours: 0.2, duration: 190 },
    {
      status: "rejected",
      offsetHours: 8,
      duration: 95,
      rejectionReason: "Face anonymization failed — bystander visible in frame 00:41.",
    },
  ];

  for (const [i, e] of episodeSeeds.entries()) {
    await prisma.episode.create({
      data: {
        datasetId: draftDataset.id,
        capturedAt: new Date(now.getTime() - e.offsetHours * 3600_000),
        durationSeconds: e.duration,
        sizeBytes: BigInt(80_000_000 + i * 12_000_000),
        objectKey: `${draftDataset.objectPrefix}episode-${String(i + 1).padStart(3, "0")}.mp4`,
        status: e.status,
        rejectionReason: e.rejectionReason,
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

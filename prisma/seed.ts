import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

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

  const sampleDatasets = [
    {
      slug: "egotask-sample",
      title: "EgoTask — Sample",
      modalityKey: "egocentric",
      description: "Long-horizon task interaction clips for embodied AI and multistep robotics learning.",
    },
    {
      slug: "egograsp-sample",
      title: "EgoGrasp — Sample",
      modalityKey: "egocentric",
      description: "Close-range hand-object interaction clips for dexterous manipulation models.",
    },
    {
      slug: "teleop-kitchen-sample",
      title: "Teleop Kitchen — Sample",
      modalityKey: "teleop",
      description: "Operator-driven kitchen manipulation traces with synced joint state logs.",
    },
    {
      slug: "mocap-locomotion-sample",
      title: "MOCAP Locomotion — Sample",
      modalityKey: "mocap",
      description: "Marker-based whole-body locomotion trajectories for humanoid gait training.",
    },
  ];

  for (const d of sampleDatasets) {
    await prisma.dataset.create({
      data: {
        slug: d.slug,
        title: d.title,
        description: d.description,
        modalityId: modalities.get(d.modalityKey)!,
        accessTier: "sample",
        status: "published",
        version: "v1",
        sizeBytes: BigInt(2_500_000_000),
        r2Prefix: `samples/${d.slug}/`,
      },
    });
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
      r2Prefix: "datasets/egograsp-acme-v2/",
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
      r2Prefix: "datasets/egonav-indoor-draft/",
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
        r2Key: `${draftDataset.r2Prefix}episode-${String(i + 1).padStart(3, "0")}.mp4`,
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

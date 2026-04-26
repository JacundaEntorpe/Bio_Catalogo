import bcrypt from "bcryptjs";
import { IdentificationStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("biocatalog-demo", 10);

  const user = await prisma.user.upsert({
    where: { email: "naturalist@biocatalog.local" },
    update: {},
    create: {
      email: "naturalist@biocatalog.local",
      name: "Demo Naturalist",
      passwordHash
    }
  });

  const life = await prisma.category.upsert({
    where: { slug: "life" },
    update: {},
    create: {
      name: "Life",
      slug: "life",
      description: "Root of the classification tree."
    }
  });

  const animals = await prisma.category.upsert({
    where: { slug: "animals" },
    update: { parentId: life.id },
    create: {
      name: "Animals",
      slug: "animals",
      parentId: life.id,
      description: "Multicellular organisms that ingest organic matter."
    }
  });

  const plants = await prisma.category.upsert({
    where: { slug: "plants" },
    update: { parentId: life.id },
    create: {
      name: "Plants",
      slug: "plants",
      parentId: life.id,
      description: "Mostly photosynthetic eukaryotes."
    }
  });

  const fungi = await prisma.category.upsert({
    where: { slug: "fungi" },
    update: { parentId: life.id },
    create: {
      name: "Fungi",
      slug: "fungi",
      parentId: life.id,
      description: "Organisms including molds, yeasts, and mushrooms."
    }
  });

  const butterflies = await prisma.category.upsert({
    where: { slug: "butterflies" },
    update: { parentId: animals.id },
    create: {
      name: "Butterflies",
      slug: "butterflies",
      parentId: animals.id,
      description: "Lepidoptera often observed in gardens and open fields.",
      ownerId: user.id
    }
  });

  const entry = await prisma.entry.upsert({
    where: { id: "cm-demo-blue-morpho" },
    update: {
      categoryId: butterflies.id,
      ownerId: user.id
    },
    create: {
      id: "cm-demo-blue-morpho",
      ownerId: user.id,
      categoryId: butterflies.id,
      name: "Blue Morpho",
      description:
        "A large iridescent butterfly observed gliding between shaded forest edges and open clearings.",
      identificationStatus: IdentificationStatus.POSSIBLE,
      locationText: "Atlantic Forest fragment, southeastern Brazil",
      habitatText: "Forest edge with filtered sunlight and nearby stream.",
      habitatTags: ["forest-edge", "flying", "canopy"],
      behaviorText: "Slow gliding flight with periodic basking on sunlit leaves.",
      images: {
        create: [
          {
            fileName: "blue-morpho-cover.svg",
            storagePath: "/uploads/demo/blue-morpho-cover.svg",
            caption: "Primary dorsal wing view",
            sortOrder: 0
          },
          {
            fileName: "blue-morpho-side.svg",
            storagePath: "/uploads/demo/blue-morpho-side.svg",
            caption: "Resting posture on broad leaf",
            sortOrder: 1
          }
        ]
      },
      observations: {
        create: [
          {
            observerId: user.id,
            title: "Morning pass over stream",
            notes:
              "The specimen crossed the stream corridor twice before resting close to the bank.",
            habitatTags: ["stream", "forest-edge"],
            behaviorText: "Patrolling flight route",
            locationText: "Shaded creek margin"
          }
        ]
      }
    }
  });

  await prisma.entry.upsert({
    where: { id: "cm-demo-bracket-fungus" },
    update: {
      categoryId: fungi.id,
      ownerId: user.id
    },
    create: {
      id: "cm-demo-bracket-fungus",
      ownerId: user.id,
      categoryId: fungi.id,
      name: "Bracket Fungus",
      description: "Shelf-like fruiting body attached to a decaying tree trunk.",
      identificationStatus: IdentificationStatus.UNKNOWN,
      locationText: "Humid woodland trail",
      habitatText: "Dead hardwood log in dense understory.",
      habitatTags: ["deadwood", "humid", "forest-floor"],
      behaviorText: "Stationary fruiting body with layered growth rings.",
      observations: {
        create: [
          {
            observerId: user.id,
            title: "After rainfall",
            notes: "Surface appeared saturated and darker after overnight rain.",
            habitatTags: ["humid", "deadwood"],
            locationText: "North-facing slope"
          }
        ]
      }
    }
  });

  console.log(`Seeded demo entry ${entry.name ?? entry.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
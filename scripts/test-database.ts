import "dotenv/config";
import prisma from "../lib/prisma";

async function testDatabase() {
  console.log("Testing database connection...");

  try {
    const filmstrip = await prisma.filmstrip.create({
      data: {
        title: "Teszt diafilm",
        firstImageUrl: "https://example.com/slides/01.jpg",
        nfcCards: { create: { uid: `test-${Date.now()}` } },
      },
      include: { nfcCards: true },
    });
    console.log("Created filmstrip:", filmstrip);

    const count = await prisma.filmstrip.count();
    console.log(`Filmstrips in database: ${count}`);

    await prisma.filmstrip.delete({ where: { id: filmstrip.id } });
    console.log("Test data cleaned up. All tests passed.");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();

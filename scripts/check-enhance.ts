import "dotenv/config"
import prisma from "../lib/prisma"

const films = await prisma.filmstrip.findMany({
  select: {
    id: true,
    title: true,
    enhanceQuality: true,
    enhancedFrameCount: true,
    enhancedSourceUrl: true,
    firstImageUrl: true,
  },
})
for (const film of films) {
  console.log({
    id: film.id,
    title: film.title,
    enhanceQuality: film.enhanceQuality,
    enhancedFrameCount: film.enhancedFrameCount,
    sourceMatch: film.enhancedSourceUrl === film.firstImageUrl,
    source: film.enhancedSourceUrl,
    first: film.firstImageUrl,
  })
}
await prisma.$disconnect()

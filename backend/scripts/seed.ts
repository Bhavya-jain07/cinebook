/**
 * One-time demo data: a handful of movies, a couple of theaters, and
 * showtimes for the next few days. One showtime is deliberately given a
 * very low `maxConcurrentOverride` so the virtual waiting room is easy to
 * trigger and demo (just open a few browser tabs).
 *
 * Run with: npm run seed
 */
import mongoose from "mongoose";
import { MovieModel, TheaterModel, ShowtimeModel } from "../src/db";
import { MONGO_URL } from "../src/config";

async function main() {
  await mongoose.connect(MONGO_URL);
  console.log("Connected to MongoDB.");

  console.log("Clearing existing demo data...");
  await Promise.all([MovieModel.deleteMany({}), TheaterModel.deleteMany({}), ShowtimeModel.deleteMany({})]);

  const movies = await MovieModel.insertMany([
    {
      title: "Interstellar",
      poster: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
      genre: "Sci-Fi",
      language: "English",
      durationMins: 169,
      description: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
    },
    {
      title: "The Dark Knight",
      poster: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
      genre: "Action",
      language: "English",
      durationMins: 152,
      description: "Batman raises the stakes in his war on crime against the Joker, who plunges Gotham into anarchy.",
    },
    {
      title: "3 Idiots",
      poster: "https://image.tmdb.org/t/p/w500/66A9MqXOyVFCssoloscw79z8Tew.jpg",
      genre: "Comedy-Drama",
      language: "Hindi",
      durationMins: 170,
      description: "Two friends search for their long-lost companion, recalling their college days and his impact on their lives.",
    },
    {
      title: "Spider-Man: Across the Spider-Verse",
      poster: "https://image.tmdb.org/t/p/w500/8Vt6mWEReuy4Of61Lnj5Xj16Tdo.jpg",
      genre: "Animation",
      language: "English",
      durationMins: 140,
      description: "Miles Morales catapults across the Multiverse, encountering a team of Spider-People tasked with protecting its very existence.",
    },
  ]);
  console.log(`Inserted ${movies.length} movies.`);

  const theaters = await TheaterModel.insertMany([
    { name: "PVR Cinemas", city: "Bharatpur" },
    { name: "INOX Multiplex", city: "Jaipur" },
  ]);
  console.log(`Inserted ${theaters.length} theaters.`);

  const now = Date.now();
  const showtimes: any[] = [];

  for (const movie of movies) {
    for (const theater of theaters) {
      // Two showtimes per movie per theater, over the next 2 days.
      for (const dayOffset of [0, 1]) {
        for (const hour of [15, 19]) {
          const dateTime = new Date(now + dayOffset * 86400000);
          dateTime.setHours(hour, 0, 0, 0);
          showtimes.push({
            movieId: movie._id,
            theaterId: theater._id,
            screenName: `Screen ${1 + Math.floor(Math.random() * 4)}`,
            dateTime,
            rows: 8,
            seatsPerRow: 10,
            premiumRowIndexes: [5, 6, 7],
            regularPrice: 180,
            premiumPrice: 320,
          });
        }
      }
    }
  }

  const inserted = await ShowtimeModel.insertMany(showtimes);
  console.log(`Inserted ${inserted.length} showtimes.`);

  // Make the very first showtime a "high demand" one for demoing the
  // virtual waiting room — only 2 people can be picking seats at once.
  if (inserted.length > 0) {
    inserted[0].maxConcurrentOverride = 2;
    await inserted[0].save();
    console.log(`Showtime ${inserted[0]._id} set to maxConcurrentOverride=2 (demo the waiting room here).`);
  }

  console.log("Done.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});

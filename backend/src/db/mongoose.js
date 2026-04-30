import mongoose from "mongoose";

const normalizeOptionalUserIdIndexes = async () => {
  const db = mongoose.connection.db;
  const targets = ["patients", "doctors"];

  for (const collectionName of targets) {
    const collection = db.collection(collectionName);

    // ❌ BEFORE: You had userId: null values
    // This breaks unique indexes
    // ✅ FIX: remove them completely
    await collection.updateMany(
      { userId: null },
      { $unset: { userId: "" } }
    );

    const indexes = await collection.indexes();

    const userIdIndex = indexes.find(
      (index) => index.name === "userId_1"
    );

    // ❌ BEFORE: Mongo already had a "userId_1" index (sparse)
    // You tried to create a different one → conflict
    // ✅ FIX: drop old index first
    if (userIdIndex) {
      await collection.dropIndex("userId_1");
    }

    // ✅ Create correct index
    await collection.createIndex(
      { userId: 1 },
      {
        name: "userId_1",
        unique: true,
        partialFilterExpression: {
          userId: { $type: "objectId" },
        },
      }
    );
  }
};

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI, {
    autoIndex: false, // 🔥 IMPORTANT: stops Mongoose from creating conflicting indexes
  });

  // ❌ BEFORE: this ran every startup (can cause repeated conflicts)
  // ✅ BETTER: run only when needed
  if (process.env.RUN_INDEX_MIGRATION === "true") {
    await normalizeOptionalUserIdIndexes();
  }

  console.log("Database connected...");
};

export default connectDB;
import mongoose from "mongoose";

const normalizeOptionalUserIdIndexes = async () => {
  const db = mongoose.connection.db;
  const targets = ["patients", "doctors"];

  for (const collectionName of targets) {
    const collection = db.collection(collectionName);

    // Existing data may contain null userId values from older writes.
    // Unset them so optional userId can remain truly optional.
    await collection.updateMany({ userId: null }, { $unset: { userId: "" } });

    const indexes = await collection.indexes();
    const userIdIndex = indexes.find((index) => index.name === "userId_1");

    if (userIdIndex) {
      await collection.dropIndex("userId_1");
    }

    await collection.createIndex(
      { userId: 1 },
      {
        name: "userId_1",
        unique: true,
        partialFilterExpression: { userId: { $type: "objectId" } },
      }
    );
  }
};

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await normalizeOptionalUserIdIndexes();
  console.log("Database connected...!");
};

export default connectDB;

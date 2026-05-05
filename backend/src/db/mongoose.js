import mongoose from "mongoose";

/** True after a successful mongoose.connect (readyState === connected). */
let connectionEstablished = false;

let wireEventsOnce = false;

function wireConnectionEvents() {
  if (wireEventsOnce) return;
  wireEventsOnce = true;

  mongoose.connection.on("connected", () => {
    connectionEstablished = mongoose.connection.readyState === 1;
    console.log("[MongoDB] Mongoose connected");
  });

  mongoose.connection.on("error", (err) => {
    connectionEstablished = false;
    console.error("[MongoDB] Mongoose connection error:", err?.message || err);
  });

  mongoose.connection.on("disconnected", () => {
    connectionEstablished = false;
    console.warn("[MongoDB] Mongoose disconnected");
  });
}

/**
 * Atlas / cloud: use `mongodb+srv://user:pass@cluster.../dbname?...`
 * Local Docker: `mongodb://host:27017/dbname`
 */
function describeUri(uri) {
  const s = String(uri || "").trim();
  if (!s) return { kind: "missing", usesSrv: false };
  const usesSrv = s.startsWith("mongodb+srv://");
  const usesStandard = s.startsWith("mongodb://");
  return {
    kind: usesSrv ? "srv" : usesStandard ? "standard" : "unknown",
    usesSrv,
  };
}

/**
 * Mongoose connection with sensible defaults for Atlas (serverless / Render).
 * @returns {{ ok: true } | { ok: false, error: Error }}
 */
export async function connectDB() {
  wireConnectionEvents();

  const uri = String(process.env.MONGO_URI || "").trim();
  if (!uri) {
    const err = new Error("MONGO_URI is not set");
    console.error(
      "[MongoDB] Missing MONGO_URI. Set it in Render → Environment (or in backend/.env for local dev).",
    );
    connectionEstablished = false;
    return { ok: false, error: err };
  }

  const { kind, usesSrv } = describeUri(uri);
  const onRender =
    process.env.RENDER === "true" ||
    process.env.RENDER === "1" ||
    Boolean(process.env.RENDER_SERVICE_ID);

  if (kind === "unknown") {
    console.warn(
      "[MongoDB] URI does not start with mongodb:// or mongodb+srv:// — connection may fail.",
    );
  }

  if (onRender && !usesSrv) {
    console.warn(
      "[MongoDB] On Render, MongoDB Atlas usually uses a connection string beginning with mongodb+srv:// (not a raw host IP). Copy the full string from Atlas → Connect → Drivers.",
    );
  }

  try {
    await mongoose.connect(uri, {
      autoIndex: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15_000,
      socketTimeoutMS: 45_000,
      family: 4,
    });

    connectionEstablished = mongoose.connection.readyState === 1;

    const host =
      mongoose.connection.host ||
      (mongoose.connection.client?.options?.hosts || []).join(",") ||
      "(see Atlas cluster)";

    console.log("[MongoDB] Connected successfully", {
      host,
      name: mongoose.connection.name,
      readyState: mongoose.connection.readyState,
    });

    if (process.env.RUN_INDEX_MIGRATION === "true") {
      await normalizeOptionalUserIdIndexes();
    }

    return { ok: true };
  } catch (err) {
    connectionEstablished = false;
    const name = err?.name || "Error";
    const msg = err?.message || String(err);

    console.error("[MongoDB] Connection failed:", { name, message: msg });

    if (name === "MongoServerSelectionError" || /ECONNREFUSED/i.test(msg)) {
      console.error(
        "[MongoDB] Server selection / refused — check: (1) Network Access in Atlas allows 0.0.0.0/0 or Render outbound IPs, (2) cluster is not paused, (3) user/password in URI are correct, (4) URI uses mongodb+srv:// for Atlas.",
      );
    }

    return { ok: false, error: err };
  }
}

export function isDatabaseConnected() {
  return connectionEstablished && mongoose.connection.readyState === 1;
}

export function getMongoConnectionState() {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  const rs = mongoose.connection.readyState;
  return { readyState: rs, label: states[rs] ?? String(rs) };
}

const normalizeOptionalUserIdIndexes = async () => {
  const db = mongoose.connection.db;
  const targets = ["patients", "doctors"];

  for (const collectionName of targets) {
    const collection = db.collection(collectionName);

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
        partialFilterExpression: {
          userId: { $type: "objectId" },
        },
      },
    );
  }
};

export default connectDB;

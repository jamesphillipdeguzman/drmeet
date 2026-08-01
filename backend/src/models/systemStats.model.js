import mongoose from 'mongoose';

const systemStatsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'visitor_stats',
    },
    totalVisits: {
      type: Number,
      default: 0,
    },
    uniqueVisits: {
      type: Number,
      default: 0,
    },
    visitorIds: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('SystemStats', systemStatsSchema);

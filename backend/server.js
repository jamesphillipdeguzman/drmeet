// Must run before any module that reads process.env (e.g. Cloudinary) — ESM hoists imports above other statements.
import './src/config/loadEnv.js';

import http from 'http';
import jwt from 'jsonwebtoken';
import { Server as SocketIOServer } from 'socket.io';

import connectDB, { isDatabaseConnected } from './src/db/mongoose.js';
import { app } from './app.js';
import './src/models/billing.model.js';
import './src/models/payment.model.js';
import './src/models/serviceCatalog.model.js';
import './src/models/medicationCatalog.model.js';
import './src/models/supplyCatalog.model.js';
import Conversation from './src/models/conversation.model.js';
import Message from './src/models/message.model.js';
import Doctor from './src/models/doctor.model.js';
import {
  buildUserConversationsQuery,
  userMayAccessConversationType,
} from './src/utils/conversationAccess.js';

// Define PORT from environment variables
const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    const dbResult = await connectDB();
    if (!dbResult.ok) {
      console.warn(
        '[DrMeet] MongoDB is not reachable — HTTP server will still start in degraded mode. API routes that use the database will fail until MONGO_URI is correct and Atlas accepts connections.',
      );
      if (dbResult.error?.message) {
        console.warn('[DrMeet] Last connection error:', dbResult.error.message);
      }
    } else {
      console.log('[DrMeet] MongoDB connection ready.');
    }

    const httpServer = http.createServer(app);
    const clientOrigin = process.env.CLIENT_ORIGIN || '*';

    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: clientOrigin,
        credentials: true,
      },
    });

    io.use((socket, next) => {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        socket?.request?.headers?.authorization?.replace(/^Bearer\s+/i, '');

      if (!token) return next(new Error('Missing token'));

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        return next();
      } catch (err) {
        return next(new Error('Invalid token'));
      }
    });

    io.on('connection', async (socket) => {
      const userId = socket.user?.id || socket.user?._id;
      const role = socket.user?.role;

      if (!userId) {
        socket.disconnect(true);
        return;
      }

      let doctorUserId = null;
      if (role === 'receptionist' && socket.user?.linkedDoctorId) {
        try {
          const doc = await Doctor.findById(socket.user.linkedDoctorId).select('userId').lean();
          if (doc) doctorUserId = doc.userId;
        } catch (e) {
          // ignore doctor fetch error
        }
      }

      const filter = buildUserConversationsQuery(socket.user, doctorUserId);

      const conversations = await Conversation.find(filter).select('_id');
      conversations.forEach((c) => socket.join(String(c._id)));

      socket.on('typing:start', async (payload = {}) => {
        try {
          const conversationId = String(payload.conversationId || '');
          if (!conversationId) return;
          if (role === 'admin') return; // Admins excluded

          let conversation = null;
          if (role === 'receptionist' && socket.user?.linkedDoctorId) {
            const doc = await Doctor.findById(socket.user.linkedDoctorId).select('userId').lean();
            if (doc?.userId) {
              conversation = await Conversation.findOne({
                _id: conversationId,
                $or: [
                  { participants: userId },
                  { participants: doc.userId, conversationType: 'patient-doctor' }
                ]
              });
            }
          }
          if (!conversation) {
            conversation = await Conversation.findOne({ _id: conversationId, participants: userId });
          }

          if (!conversation) return;
          if (!userMayAccessConversationType(role, conversation.conversationType)) return;
          socket.to(conversationId).emit('typing:update', {
            conversationId,
            userId: String(userId),
            typing: true,
          });
        } catch {
          // ignore typing errors
        }
      });

      socket.on('typing:stop', async (payload = {}) => {
        try {
          const conversationId = String(payload.conversationId || '');
          if (!conversationId) return;
          if (role === 'admin') return; // Admins excluded

          let conversation = null;
          if (role === 'receptionist' && socket.user?.linkedDoctorId) {
            const doc = await Doctor.findById(socket.user.linkedDoctorId).select('userId').lean();
            if (doc?.userId) {
              conversation = await Conversation.findOne({
                _id: conversationId,
                $or: [
                  { participants: userId },
                  { participants: doc.userId, conversationType: 'patient-doctor' }
                ]
              });
            }
          }
          if (!conversation) {
            conversation = await Conversation.findOne({ _id: conversationId, participants: userId });
          }

          if (!conversation) return;
          if (!userMayAccessConversationType(role, conversation.conversationType)) return;
          socket.to(conversationId).emit('typing:update', {
            conversationId,
            userId: String(userId),
            typing: false,
          });
        } catch {
          // ignore typing errors
        }
      });

      socket.on('sendMessage', async (payload, ack) => {
        try {
          const conversationId = payload?.conversationId;
          const text = payload?.message;

          if (!conversationId || typeof text !== 'string' || !text.trim()) {
            if (ack) return ack({ error: 'conversationId and message are required' });
            return;
          }

          if (role === 'admin') {
            if (ack) return ack({ error: 'Forbidden' });
            return;
          }

          let conversation = null;
          if (role === 'receptionist' && socket.user?.linkedDoctorId) {
            const doc = await Doctor.findById(socket.user.linkedDoctorId).select('userId').lean();
            if (doc?.userId) {
              conversation = await Conversation.findOne({
                _id: conversationId,
                $or: [
                  { participants: userId },
                  { participants: doc.userId, conversationType: 'patient-doctor' }
                ]
              });
            }
          }
          if (!conversation) {
            conversation = await Conversation.findOne({ _id: conversationId, participants: userId });
          }

          if (!conversation) {
            if (ack) return ack({ error: 'Forbidden' });
            return;
          }

          if (!userMayAccessConversationType(role, conversation.conversationType)) {
            if (ack) return ack({ error: 'Forbidden' });
            return;
          }

          const newMessage = await Message.create({
            conversationId: conversation._id,
            senderId: userId,
            message: text.trim(),
            readBy: [userId],
            onBehalfOf: role === 'receptionist' ? `${socket.user.firstName} ${socket.user.lastName}` : '',
          });

          await newMessage.populate('senderId', 'firstName lastName email role');

          await Conversation.findByIdAndUpdate(conversation._id, {
            lastMessage: newMessage.message,
            lastMessageAt: new Date(),
          });

          // Emit only to the conversation room (no global broadcasts).
          io.to(String(conversationId)).emit('newMessage', newMessage);

          if (ack) return ack({ ok: true, message: newMessage });
        } catch (err) {
          if (ack) return ack({ error: err.message || 'sendMessage failed' });
        }
      });
    });

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      if (!isDatabaseConnected()) {
        console.warn(
          `[DrMeet] Health tip: fix MONGO_URI (Atlas mongodb+srv://…), whitelist 0.0.0.0/0 in Network Access, and confirm the cluster is not paused.`,
        );
      }
    });
  } catch (error) {
    console.error('[DrMeet] Fatal startup error:', error);
    process.exit(1);
  }
};

startServer();

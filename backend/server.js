// Must run before any module that reads process.env (e.g. Cloudinary) — ESM hoists imports above other statements.
import './src/config/loadEnv.js';

console.log('🧪 RAW ENV CHECK (BEFORE EVERYTHING):', {
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  CLOUDINARY_URL: process.env.CLOUDINARY_URL,
  NODE_ENV: process.env.NODE_ENV,
});

import http from 'http';
import jwt from 'jsonwebtoken';
import { Server as SocketIOServer } from 'socket.io';

import connectDB from './src/db/mongoose.js';
import { app } from './app.js';
import Conversation from './src/models/conversation.model.js';
import Message from './src/models/message.model.js';
import {
  buildUserConversationsQuery,
  userMayAccessConversationType,
} from './src/utils/conversationAccess.js';

// Define PORT from environment variables
const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    await connectDB();

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

      const filter =
        role === 'admin' ? {} : buildUserConversationsQuery(socket.user);

      const conversations = await Conversation.find(filter).select('_id');
      conversations.forEach((c) => socket.join(String(c._id)));

      socket.on('sendMessage', async (payload, ack) => {
        try {
          const conversationId = payload?.conversationId;
          const text = payload?.message;

          if (!conversationId || typeof text !== 'string' || !text.trim()) {
            if (ack) return ack({ error: 'conversationId and message are required' });
            return;
          }

          // Security: non-admin can only send to conversations they belong to.
          const conversation = role === 'admin'
            ? await Conversation.findById(conversationId)
            : await Conversation.findOne({ _id: conversationId, participants: userId });

          if (!conversation) {
            if (ack) return ack({ error: 'Forbidden' });
            return;
          }

          if (
            role !== 'admin' &&
            !userMayAccessConversationType(role, conversation.conversationType)
          ) {
            if (ack) return ack({ error: 'Forbidden' });
            return;
          }

          const newMessage = await Message.create({
            conversationId: conversation._id,
            senderId: userId,
            message: text.trim(),
            readBy: [userId],
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
    });
  } catch (error) {
    console.error('Error connecting to the database', error);
    process.exit(1); // Exit with error
  }
};

startServer();

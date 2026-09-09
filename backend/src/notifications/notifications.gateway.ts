import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { Notification, DeliveryStatus } from './notification.entity';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('NotificationsGateway');
  private connectedClients = new Map<string, { socket: Socket; role: string; userId: string }>();

  handleConnection(client: Socket) {
    try {
      this.logger.log(`Client connected: ${client.id}`);
    } catch (error) {
      this.logger.error(`Error handling connection for client ${client.id}:`, error);
    }
  }

  handleDisconnect(client: Socket) {
    try {
      this.connectedClients.delete(client.id);
      this.logger.log(`Client disconnected: ${client.id}`);
    } catch (error) {
      this.logger.error(`Error handling disconnect for client ${client.id}:`, error);
    }
  }

  @SubscribeMessage('register')
  handleRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { role: string; userId: string },
  ) {
    try {
      if (!data.role || !data.userId) {
        this.logger.warn(`❌ Invalid registration data from client ${client.id}:`, data);
        client.emit('registration_error', { success: false, error: 'Invalid registration data' });
        return;
      }

      this.connectedClients.set(client.id, {
        socket: client,
        role: data.role,
        userId: data.userId,
      });
      
      // Join role-based room
      client.join(`role:${data.role}`);
      this.logger.log(`🏠 Client ${client.id} joined room: role:${data.role}`);
      
      // Join user-specific room
      client.join(`user:${data.userId}`);
      this.logger.log(`🏠 Client ${client.id} joined room: user:${data.userId}`);
      
      this.logger.log(`✅ User ${data.userId} (${data.role}) registered successfully`);
      
      // Send confirmation with current room memberships
      const rooms = Array.from(client.rooms).filter(room => room !== client.id);
      client.emit('registered', { 
        success: true, 
        userId: data.userId, 
        role: data.role,
        rooms,
        message: `Registered for role: ${data.role} and user: ${data.userId}`
      });
    } catch (error) {
      this.logger.error(`❌ Error handling registration for client ${client.id}:`, error);
      client.emit('registration_error', { success: false, error: 'Registration failed' });
    }
  }

  // emitNotification(notification: Notification) {
  //   const payload = { notification };

  //   if (notification.targetUserId) {
  //     this.server.to(`user:${notification.targetUserId}`).emit('notification', payload);
  //   } else if (notification.targetRole) {
  //     this.server.to(`role:${notification.targetRole}`).emit('notification', payload);
  //   } else {
  //     // Broadcast to all
  //     this.server.emit('notification', payload);
  //   }
  // }

  emitNotification(notification: Notification) {
    try {
      const payload = { notification };

      this.logger.log(
        `🔔 EMIT notification=${notification.id} targetUser=${notification.targetUserId} targetRole=${notification.targetRole}`
      );

      if (notification.targetUserId) {
        const room = `user:${notification.targetUserId}`;

        this.logger.log(`➡️ Sending to room: ${room}`);

        this.server
          .to(room)
          .emit('notification', payload);

        this.logger.log(`✅ Sent to user room: ${room}`);

      } else if (notification.targetRole) {
        const room = `role:${notification.targetRole}`;

        this.logger.log(`➡️ Sending to room: ${room}`);

        this.server
          .to(room)
          .emit('notification', payload);

        this.logger.log(`✅ Sent to role room: ${room}`);

      } else {
        this.logger.log('➡️ Broadcasting notification');

        this.server.emit(
          'notification',
          payload
        );
        
        this.logger.log('✅ Broadcasted to all clients');
      }
    } catch (error) {
      this.logger.error(`Error emitting notification ${notification.id}:`, error);
      // Don't throw - errors shouldn't crash the gateway
    }
  }

  emitToAll(event: string, data: any) {
    try {
      this.server.emit(event, data);
    } catch (error) {
      this.logger.error(`Error emitting event ${event}:`, error);
    }
  }

  // Method to check if a user is currently connected
  isUserConnected(userId: string): boolean {
    for (const client of this.connectedClients.values()) {
      if (client.userId === userId) {
        return true;
      }
    }
    return false;
  }

  // Method to get all connected users for a specific role
  getConnectedUsersByRole(role: string): string[] {
    const userIds: string[] = [];
    for (const client of this.connectedClients.values()) {
      if (client.role === role) {
        userIds.push(client.userId);
      }
    }
    return userIds;
  }

  // Method to get all connected clients for debugging
  getAllConnectedClients(): Array<{ socketId: string; userId: string; role: string }> {
    const clients: Array<{ socketId: string; userId: string; role: string }> = [];
    for (const [socketId, client] of this.connectedClients.entries()) {
      clients.push({
        socketId,
        userId: client.userId,
        role: client.role,
      });
    }
    return clients;
  }
}

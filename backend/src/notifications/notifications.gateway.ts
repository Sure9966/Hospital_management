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
import { Notification } from './notification.entity';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('NotificationsGateway');
  private connectedClients = new Map<string, { socket: Socket; role: string; userId: string }>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('register')
  handleRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { role: string; userId: string },
  ) {
    this.connectedClients.set(client.id, {
      socket: client,
      role: data.role,
      userId: data.userId,
    });
    client.join(`role:${data.role}`);
    client.join(`user:${data.userId}`);
    this.logger.log(`User ${data.userId} (${data.role}) registered`);
  }

  emitNotification(notification: Notification) {
    const payload = { notification };

    if (notification.targetUserId) {
      this.server.to(`user:${notification.targetUserId}`).emit('notification', payload);
    } else if (notification.targetRole) {
      this.server.to(`role:${notification.targetRole}`).emit('notification', payload);
    } else {
      // Broadcast to all
      this.server.emit('notification', payload);
    }
  }

  emitToAll(event: string, data: any) {
    this.server.emit(event, data);
  }
}

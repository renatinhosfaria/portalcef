import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { SessionService } from "../auth/session.service";

@WebSocketGateway({
  namespace: "/tarefas",
  cors: { origin: "*", credentials: true },
})
export class TarefasGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TarefasGateway.name);

  constructor(private readonly sessionService: SessionService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const cookie = client.handshake.headers.cookie ?? "";
      const sessionToken = this.extrairCookie(cookie, "session");

      if (!sessionToken) {
        client.disconnect();
        return;
      }

      const sessao = await this.sessionService.getSession(sessionToken);

      if (!sessao) {
        client.disconnect();
        return;
      }

      await client.join(`usuario:${sessao.userId}`);
      this.logger.debug(`Cliente conectado: usuario:${sessao.userId}`);
    } catch (err) {
      this.logger.error("Erro na conexão WebSocket", err);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Cliente desconectado: ${client.id}`);
  }

  emitirParaUsuario(
    userId: string,
    evento: string,
    payload: unknown,
  ): void {
    this.server.to(`usuario:${userId}`).emit(evento, payload);
  }

  private extrairCookie(
    cookieHeader: string,
    nome: string,
  ): string | null {
    const match = cookieHeader.match(
      new RegExp(`(?:^|; )${nome}=([^;]*)`),
    );
    return match ? decodeURIComponent(match[1]) : null;
  }
}

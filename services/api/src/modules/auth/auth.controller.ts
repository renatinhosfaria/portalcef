import {
  Controller,
  Post,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  Get,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyReply, FastifyRequest } from "fastify";
import { loginSchema } from "@essencia/shared/schemas";

import { AuthService } from "./auth.service";

const COOKIE_NAME = "cef_session";

@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    // Validate input
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados inválidos",
          details: result.error.flatten(),
        },
      };
    }

    const { email, password } = result.data;
    const loginResult = await this.authService.login(email, password);

    // Set session cookie
    const cookieDomain = this.configService.get<string>("COOKIE_DOMAIN");
    res.setCookie(COOKIE_NAME, loginResult.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      domain: cookieDomain,
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return {
      success: true,
      data: {
        user: loginResult.user,
      },
    };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: FastifyReply) {
    // Get token from cookie
    const request = res.request as FastifyRequest;
    const token = request.cookies?.[COOKIE_NAME];

    if (token) {
      await this.authService.logout(token);
    }

    // Clear cookie
    res.clearCookie(COOKIE_NAME, { path: "/" });

    return {
      success: true,
      data: null,
    };
  }

  @Get("me")
  async me(@Res({ passthrough: true }) res: FastifyReply) {
    const request = res.request as FastifyRequest;
    const token = request.cookies?.[COOKIE_NAME];

    if (!token) {
      throw new UnauthorizedException("Não autenticado");
    }

    const user = await this.authService.getCurrentUser(token);

    return {
      success: true,
      data: { user },
    };
  }
}

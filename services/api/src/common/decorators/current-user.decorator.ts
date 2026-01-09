import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import { AuthenticatedRequest } from "../guards/auth.guard";

/**
 * Decorator to extract the current user from the request
 * @example
 * @Get('profile')
 * @UseGuards(AuthGuard)
 * getProfile(@CurrentUser() user: { userId: string; role: string; schoolId: string; unitId: string; stageId: string | null }) {
 *   return user;
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);

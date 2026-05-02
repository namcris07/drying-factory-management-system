import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ActorContext } from './permissions';

type RequestWithActor = {
  actor?: ActorContext;
};

export const CurrentActor = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): ActorContext | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithActor>();
    return request.actor;
  },
);

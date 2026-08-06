import { Controller, Get } from '@nestjs/common';

@Controller('notifications')
export class NotificationController {
  @Get('health')
  getHealth() {
    return { status: 'ok', service: 'notification-service' };
  }
}

import { Controller, Get } from '@nestjs/common';
import {Public} from './security/guards.js';
@Controller('health')
export class AppController {
  @Get() @Public()
  getHealth() { return { status: 'ok' }; }
}

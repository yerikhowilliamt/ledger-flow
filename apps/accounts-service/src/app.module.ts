import { Module } from '@nestjs/common';
import { AccountModule } from './modules/account/account.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, AccountModule],
  controllers: [],
  providers: [],
})
export class AppModule {}

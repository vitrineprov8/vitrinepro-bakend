import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [ProfileService],
  controllers: [ProfileController],
})
export class ProfileModule {}

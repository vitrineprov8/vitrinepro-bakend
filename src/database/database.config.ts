import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Education } from '../education/education.entity';
import { CV } from '../cv/cv.entity';
import { Tag } from '../tags/tag.entity';
import { Article } from '../articles/article.entity';
import { Project } from '../projects/project.entity';
import { ProjectImage } from '../projects/project-image.entity';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  entities: [User, Education, CV, Tag, Article, Project, ProjectImage],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV !== 'production',
};

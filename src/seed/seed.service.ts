import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import slugify from 'slugify';

// ---------------------------------------------------------------------------
// Seed data constants
// ---------------------------------------------------------------------------

/** Email suffix used to identify and clean up seed records safely */
const SEED_EMAIL_SUFFIX = '@vitrinepro.dev';

const SEED_USERS = [
  {
    firstName: 'Ana',
    lastName: 'Souza',
    profession: 'UX Designer',
    location: 'São Paulo, SP',
    bio: 'Especialista em design de experiência do usuário com foco em mobile. Apaixonada por criar interfaces intuitivas e acessíveis.',
    bannerColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  {
    firstName: 'Carlos',
    lastName: 'Mendes',
    profession: 'Desenvolvedor Frontend',
    location: 'Rio de Janeiro, RJ',
    bio: 'Desenvolvedor frontend com 6 anos de experiência em React e Vue.js. Amante de performance e boas práticas.',
    bannerColor: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  },
  {
    firstName: 'Juliana',
    lastName: 'Lima',
    profession: 'Motion Designer',
    location: 'Belo Horizonte, MG',
    bio: 'Motion designer e artista visual. Crio animações que contam histórias e comunicam com impacto.',
    bannerColor: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  },
  {
    firstName: 'Rafael',
    lastName: 'Costa',
    profession: 'Product Designer',
    location: 'Curitiba, PR',
    bio: 'Product designer com experiência em startups e grandes empresas. Foco em design orientado a dados e resultados.',
    bannerColor: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  },
  {
    firstName: 'Mariana',
    lastName: 'Ferreira',
    profession: 'Ilustradora',
    location: 'Porto Alegre, RS',
    bio: 'Ilustradora digital e artista independente. Meu trabalho transita entre o editorial e o universo das marcas.',
    bannerColor: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  },
  {
    firstName: 'Lucas',
    lastName: 'Alves',
    profession: 'UI Designer',
    location: 'Salvador, BA',
    bio: 'UI designer apaixonado por tipografia, sistemas de design e interfaces pixel-perfect.',
    bannerColor: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  },
  {
    firstName: 'Beatriz',
    lastName: 'Santos',
    profession: 'Brand Designer',
    location: 'Fortaleza, CE',
    bio: 'Especialista em identidade visual e branding estratégico. Já trabalhei com mais de 80 marcas em 5 países.',
    bannerColor: 'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
  },
  {
    firstName: 'Diego',
    lastName: 'Rocha',
    profession: 'Desenvolvedor Full Stack',
    location: 'Recife, PE',
    bio: 'Full stack developer especializado em Node.js e React. Construo produtos do zero com foco em escalabilidade.',
    bannerColor: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  },
  {
    firstName: 'Camila',
    lastName: 'Oliveira',
    profession: 'Fotógrafa',
    location: 'Brasília, DF',
    bio: 'Fotógrafa corporativa e de produto. Capturo a essência de marcas e pessoas através de imagens que comunicam.',
    bannerColor: 'linear-gradient(135deg, #fd7043 0%, #ff8a65 100%)',
  },
  {
    firstName: 'Thiago',
    lastName: 'Barbosa',
    profession: '3D Artist',
    location: 'Manaus, AM',
    bio: 'Artista 3D e visualizador arquitetural. Transformo projetos em visualizações fotorrealistas de impacto.',
    bannerColor: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  },
] as const;

const SEED_TAGS = [
  'UX Design',
  'UI Design',
  'Branding',
  'Motion Design',
  'Ilustração',
  'Fotografia',
  '3D',
  'Desenvolvimento Web',
  'Product Design',
  'Mobile',
  'Frontend',
  'Identidade Visual',
  'Prototipagem',
  'Animação',
  'E-commerce',
];

type ProjectSeed = {
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  year: number;
  projectStatus: string;
};

const PROJECTS_BY_PROFESSION: Record<string, ProjectSeed[]> = {
  'UX Designer': [
    {
      title: 'App de Mobilidade Urbana',
      subtitle: 'Redesign de UX para aplicativo de transporte',
      description:
        'Pesquisa com usuários, wireframes e protótipos para redesign completo do fluxo de compra de passagens.',
      tags: ['UX Design', 'Mobile', 'Prototipagem'],
      year: 2024,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'Pesquisa de Usuário – Fintech',
      subtitle: 'Discovery e mapeamento de jornada',
      description:
        'Condução de 30 entrevistas e análise de dados para identificar oportunidades de melhoria no onboarding.',
      tags: ['UX Design', 'Product Design'],
      year: 2023,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'Design System Healthcare',
      subtitle: 'Sistema de componentes para plataforma médica',
      description:
        'Criação de biblioteca de componentes acessíveis com foco em WCAG 2.1 AA para sistema hospitalar.',
      tags: ['UI Design', 'Product Design', 'UX Design'],
      year: 2024,
      projectStatus: 'ONGOING',
    },
    {
      title: 'Wireframes E-commerce',
      subtitle: 'Arquitetura de informação para loja virtual',
      description:
        'Mapeamento de fluxos e wireframes de baixa e alta fidelidade para novo e-commerce de moda.',
      tags: ['UX Design', 'E-commerce', 'Prototipagem'],
      year: 2023,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'Teste de Usabilidade – SaaS',
      subtitle: 'Relatório de testes com usuários reais',
      description:
        'Planejamento e execução de sessões de teste moderadas e análise de métricas de usabilidade.',
      tags: ['UX Design', 'Product Design'],
      year: 2022,
      projectStatus: 'COMPLETED',
    },
  ],
  'Desenvolvedor Frontend': [
    {
      title: 'Dashboard Analytics',
      subtitle: 'Interface de visualização de dados em tempo real',
      description:
        'Dashboard responsivo com React e D3.js para exibição de métricas de vendas em tempo real.',
      tags: ['Frontend', 'Desenvolvimento Web'],
      year: 2024,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'E-commerce Next.js',
      subtitle: 'Loja virtual de alta performance',
      description: 'E-commerce com Next.js, Stripe e CMS headless, alcançando 98 no Lighthouse.',
      tags: ['Frontend', 'E-commerce', 'Desenvolvimento Web'],
      year: 2024,
      projectStatus: 'ONGOING',
    },
    {
      title: 'Design System React',
      subtitle: 'Biblioteca de componentes reutilizáveis',
      description:
        'Desenvolvimento de design system com Storybook, Tailwind e testes automatizados com Vitest.',
      tags: ['Frontend', 'UI Design'],
      year: 2023,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'App PWA – Delivery',
      subtitle: 'Progressive Web App para delivery local',
      description:
        'PWA com service workers, push notifications e modo offline para rede de restaurantes.',
      tags: ['Frontend', 'Mobile', 'Desenvolvimento Web'],
      year: 2022,
      projectStatus: 'COMPLETED',
    },
  ],
  'Motion Designer': [
    {
      title: 'Animação de Marca – Startup',
      subtitle: 'Brand motion e identidade em movimento',
      description:
        'Criação de versões animadas do logo e elementos de marca para uso em redes sociais e apresentações.',
      tags: ['Motion Design', 'Branding', 'Animação'],
      year: 2024,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'Vídeo Institucional – ONG',
      subtitle: 'Animação 2D para campanha social',
      description:
        'Produção de vídeo animado de 90 segundos para campanha de arrecadação de fundos no YouTube.',
      tags: ['Motion Design', 'Animação'],
      year: 2023,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'Motion UI – App de Fitness',
      subtitle: 'Microinterações e transições de tela',
      description:
        'Design e animação de microinterações para aplicativo de treinos, melhorando a percepção de qualidade.',
      tags: ['Motion Design', 'Mobile', 'UI Design'],
      year: 2024,
      projectStatus: 'ONGOING',
    },
    {
      title: 'Intro para Canal YouTube',
      subtitle: 'Animação de abertura 15 segundos',
      description:
        'Criação de vinheta animada com identidade visual forte para canal de tecnologia com 200k inscritos.',
      tags: ['Motion Design', 'Animação', 'Branding'],
      year: 2022,
      projectStatus: 'COMPLETED',
    },
  ],
  'Product Designer': [
    {
      title: 'Redesign App Bancário',
      subtitle: 'Simplificação do fluxo de transferências',
      description:
        'Redesign completo de fluxo crítico reduzindo de 7 para 3 passos, aumentando conversão em 23%.',
      tags: ['Product Design', 'UX Design', 'Mobile'],
      year: 2024,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'Feature de Investimentos',
      subtitle: 'Novo módulo de carteira de investimentos',
      description:
        'Discovery, prototipagem e entrega de feature de investimentos para super app financeiro.',
      tags: ['Product Design', 'UX Design'],
      year: 2023,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'Onboarding SaaS B2B',
      subtitle: 'Fluxo de ativação de novos usuários',
      description: 'Redesign do onboarding que reduziu tempo de ativação de 3 dias para 4 horas.',
      tags: ['Product Design', 'UX Design', 'Prototipagem'],
      year: 2024,
      projectStatus: 'ONGOING',
    },
    {
      title: 'Design System – Fintech',
      subtitle: 'Biblioteca de componentes escalável',
      description:
        'Construção de design system com 120 componentes, documentado no Zeroheight.',
      tags: ['Product Design', 'UI Design'],
      year: 2022,
      projectStatus: 'COMPLETED',
    },
  ],
  Ilustradora: [
    {
      title: 'Ilustrações Editorial – Revista',
      subtitle: 'Série de 12 ilustrações para publicação mensal',
      description:
        'Série de ilustrações digitais temáticas para revista de cultura e comportamento.',
      tags: ['Ilustração'],
      year: 2024,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'Personagens – App Educativo',
      subtitle: 'Mascote e personagens para plataforma infantil',
      description:
        'Criação de universo visual com 8 personagens animáveis para plataforma de educação infantil.',
      tags: ['Ilustração', 'Mobile'],
      year: 2023,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'Identidade Visual – Cafeteria',
      subtitle: 'Branding completo com ilustrações exclusivas',
      description:
        'Desenvolvimento de identidade visual com ilustrações de produtos e personagem mascote.',
      tags: ['Ilustração', 'Branding', 'Identidade Visual'],
      year: 2024,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'Comic Strip – Redes Sociais',
      subtitle: 'Série semanal para perfil de humor',
      description:
        'Produção de 40 tiras de quadrinhos digitais para perfil com 50k seguidores no Instagram.',
      tags: ['Ilustração'],
      year: 2022,
      projectStatus: 'ONGOING',
    },
  ],
  'UI Designer': [
    {
      title: 'Design System – SaaS',
      subtitle: 'Componentes e tokens para produto digital',
      description:
        'Criação de design system completo com tokens de cor, tipografia e 80 componentes no Figma.',
      tags: ['UI Design', 'Product Design'],
      year: 2024,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'Landing Page – Lançamento',
      subtitle: 'UI para página de conversão de produto',
      description:
        'Design de landing page que alcançou 34% de taxa de conversão em campanha de lançamento.',
      tags: ['UI Design', 'E-commerce'],
      year: 2023,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'App de Meditação',
      subtitle: 'Interface calma e minimalista',
      description:
        'UI design completo para app de bem-estar com foco em acessibilidade e experiência relaxante.',
      tags: ['UI Design', 'Mobile', 'UX Design'],
      year: 2024,
      projectStatus: 'ONGOING',
    },
    {
      title: 'Dashboard Administrativo',
      subtitle: 'Painel de controle para gestão de estoque',
      description:
        'Interface densa e eficiente para sistema de gestão com múltiplas tabelas e filtros avançados.',
      tags: ['UI Design', 'Desenvolvimento Web'],
      year: 2023,
      projectStatus: 'COMPLETED',
    },
  ],
  'Brand Designer': [
    {
      title: 'Identidade Visual – Restaurante',
      subtitle: 'Branding completo para nova abertura',
      description:
        'Naming, logo, paleta, tipografia e aplicações para restaurante de culinária japonesa contemporânea.',
      tags: ['Branding', 'Identidade Visual'],
      year: 2024,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'Rebranding – Clínica Médica',
      subtitle: 'Modernização de marca estabelecida',
      description:
        'Atualização de identidade visual mantendo brand equity, com novo logo, cores e manual da marca.',
      tags: ['Branding', 'Identidade Visual'],
      year: 2023,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'Marca – Startup EdTech',
      subtitle: 'Brand identity para nova empresa',
      description:
        'Criação de identidade visual completa para startup de educação, do conceito à aplicação.',
      tags: ['Branding', 'Identidade Visual', 'Ilustração'],
      year: 2024,
      projectStatus: 'ONGOING',
    },
    {
      title: 'Brand Guidelines',
      subtitle: 'Manual de marca para franquia',
      description:
        'Documentação completa de 60 páginas com regras de uso da marca para rede com 30 unidades.',
      tags: ['Branding', 'Identidade Visual'],
      year: 2022,
      projectStatus: 'COMPLETED',
    },
  ],
  'Desenvolvedor Full Stack': [
    {
      title: 'Plataforma de Cursos Online',
      subtitle: 'LMS completo com pagamentos integrados',
      description:
        'Sistema de e-learning com Node.js, React, PostgreSQL e integração com Stripe e Pagar.me.',
      tags: ['Desenvolvimento Web', 'Frontend', 'E-commerce'],
      year: 2024,
      projectStatus: 'ONGOING',
    },
    {
      title: 'API REST – Delivery',
      subtitle: 'Backend para aplicativo de entrega',
      description:
        'API escalável com NestJS, TypeORM e PostgreSQL para plataforma de delivery com 50k usuários.',
      tags: ['Desenvolvimento Web', 'Mobile'],
      year: 2023,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'Sistema de Gestão ERP',
      subtitle: 'Módulo financeiro e estoque',
      description:
        'Desenvolvimento de módulos de financeiro, estoque e relatórios para ERP de médio porte.',
      tags: ['Desenvolvimento Web', 'Frontend'],
      year: 2022,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'Dashboard Real-time',
      subtitle: 'Painel com WebSocket para monitoramento',
      description:
        'Dashboard de monitoramento com WebSocket, Redis e React para empresa de logística.',
      tags: ['Frontend', 'Desenvolvimento Web'],
      year: 2024,
      projectStatus: 'COMPLETED',
    },
  ],
  Fotógrafa: [
    {
      title: 'Ensaio Corporativo – Tech Company',
      subtitle: 'Retratos profissionais para time de 40 pessoas',
      description:
        'Ensaio fotográfico corporativo completo com retratos individuais e fotos de equipe para empresa de tecnologia.',
      tags: ['Fotografia'],
      year: 2024,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'Fotografia de Produto – Cosméticos',
      subtitle: 'E-commerce e catálogo de linha de skincare',
      description:
        'Produção fotográfica completa de linha de 25 produtos para e-commerce e material impresso.',
      tags: ['Fotografia', 'E-commerce'],
      year: 2023,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'Campanha de Moda – Primavera',
      subtitle: 'Editorial para marca de moda autoral',
      description:
        'Direção criativa e fotografia de editorial de moda com 3 locações e equipe de 8 pessoas.',
      tags: ['Fotografia', 'Branding'],
      year: 2024,
      projectStatus: 'ONGOING',
    },
    {
      title: 'Arquitetura – Hotel Boutique',
      subtitle: 'Fotografia de interiores e fachada',
      description:
        'Fotografias de arquitetura e interiores para hotel boutique em lançamento na capital.',
      tags: ['Fotografia'],
      year: 2022,
      projectStatus: 'COMPLETED',
    },
  ],
  '3D Artist': [
    {
      title: 'Visualização Arquitetural – Residência',
      subtitle: 'Renders fotorrealistas de projeto residencial',
      description:
        'Produção de 12 renders fotorrealistas de residência de alto padrão para apresentação ao cliente.',
      tags: ['3D'],
      year: 2024,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'Produto 3D – Headphones',
      subtitle: 'Modelagem e render para campanha',
      description:
        'Modelagem e texturização de headphone para campanha de produto, substituindo fotografia convencional.',
      tags: ['3D', 'Branding'],
      year: 2023,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'Character Design 3D – Game',
      subtitle: 'Personagem para jogo mobile indie',
      description:
        'Modelagem, rigging e texturização de personagem principal para jogo mobile publicado na App Store.',
      tags: ['3D', 'Mobile', 'Animação'],
      year: 2024,
      projectStatus: 'ONGOING',
    },
    {
      title: 'Cenário Virtual – Evento',
      subtitle: 'Ambientação 3D para transmissão ao vivo',
      description:
        'Criação de cenário virtual fotorrealista para evento corporativo transmitido online para 10k pessoas.',
      tags: ['3D', 'Motion Design'],
      year: 2022,
      projectStatus: 'COMPLETED',
    },
    {
      title: 'NFT Art Collection',
      subtitle: 'Série de 20 peças de arte generativa 3D',
      description:
        'Coleção de arte 3D generativa para mercado de NFTs com renders em 4K e variações únicas.',
      tags: ['3D', 'Ilustração'],
      year: 2023,
      projectStatus: 'COMPLETED',
    },
  ],
};

// ---------------------------------------------------------------------------

@Injectable()
export class SeedService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Runs the seed.
   *
   * Idempotent — returns early if seed users already exist so it is safe to
   * call multiple times.  Uses a single transaction per user so a failure in
   * one user does not corrupt the others.
   */
  async run(): Promise<{ message: string; skipped?: boolean; users?: number; portfolioItems?: number }> {
    // Idempotency guard
    const existing = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM users WHERE email LIKE $1 LIMIT 1`,
      [`%${SEED_EMAIL_SUFFIX}`],
    );
    if (existing.length > 0) {
      return { message: 'Seed already executed', skipped: true };
    }

    const passwordHash = await bcrypt.hash('seed123', 10);
    let totalItems = 0;

    for (const seedUser of SEED_USERS) {
      await this.dataSource.transaction(async (manager) => {
        // 1. Create user
        const username =
          `${seedUser.firstName.toLowerCase()}-${seedUser.lastName.toLowerCase()}`
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // strip diacritics
            .replace(/[^a-z0-9-]/g, '');

        const email = `${username}${SEED_EMAIL_SUFFIX}`;

        const userResult = await manager.query<Array<{ id: string }>>(
          `INSERT INTO users
             ("firstName", "lastName", email, password, username, profession,
              bio, location, "bannerColor", "authProvider", "isActive",
              "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'local',true,NOW(),NOW())
           RETURNING id`,
          [
            seedUser.firstName,
            seedUser.lastName,
            email,
            passwordHash,
            username,
            seedUser.profession,
            seedUser.bio,
            seedUser.location,
            seedUser.bannerColor,
          ],
        );
        const userId: string = userResult[0].id;

        // 2. Create tags for this user
        const tagIdByName: Record<string, string> = {};
        for (const tagName of SEED_TAGS) {
          const tagSlug = slugify(tagName, { lower: true, strict: true });
          const tagResult = await manager.query<Array<{ id: string }>>(
            `INSERT INTO tags ("userId", name, slug, "createdAt")
             VALUES ($1,$2,$3,NOW())
             ON CONFLICT ("userId", slug) DO NOTHING
             RETURNING id`,
            [userId, tagName, tagSlug],
          );
          if (tagResult.length > 0) {
            tagIdByName[tagName] = tagResult[0].id;
          } else {
            // ON CONFLICT path — fetch existing id
            const existing = await manager.query<Array<{ id: string }>>(
              `SELECT id FROM tags WHERE "userId" = $1 AND slug = $2`,
              [userId, tagSlug],
            );
            if (existing.length > 0) tagIdByName[tagName] = existing[0].id;
          }
        }

        // 3. Create portfolio items
        const projects = PROJECTS_BY_PROFESSION[seedUser.profession] ?? [];
        for (let i = 0; i < projects.length; i++) {
          const project = projects[i];

          // Last item is kept as DRAFT; the rest are PUBLISHED
          const status = i === projects.length - 1 ? 'DRAFT' : 'PUBLISHED';

          const slugBase = slugify(project.title, { lower: true, strict: true });
          const itemSlug = `${slugBase}-${userId.slice(0, 8)}`;

          const itemResult = await manager.query<Array<{ id: string }>>(
            `INSERT INTO portfolio_items
               ("userId", title, subtitle, slug, content, "clientName",
                year, "projectStatus", status, "createdAt", "updatedAt")
             VALUES ($1,$2,$3,$4,$5::jsonb,NULL,$6,$7,$8,NOW(),NOW())
             RETURNING id`,
            [
              userId,
              project.title,
              project.subtitle,
              itemSlug,
              JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: project.description }] }] }),
              project.year,
              project.projectStatus,
              status,
            ],
          );
          const itemId: string = itemResult[0].id;
          totalItems++;

          // 4. Associate tags via portfolio_tags join table.
          // TypeORM auto-generates the join-table column names from the
          // relation property names: the owning side uses "portfolioItemsId"
          // (plural, derived from Tag's implicit back-reference) and the
          // inverse side uses "tagsId" (the property name on PortfolioItem).
          for (const tagName of project.tags) {
            const tagId = tagIdByName[tagName];
            if (!tagId) continue;
            await manager.query(
              `INSERT INTO portfolio_tags ("portfolioItemsId", "tagsId")
               VALUES ($1,$2)
               ON CONFLICT DO NOTHING`,
              [itemId, tagId],
            );
          }
        }
      });
    }

    return {
      message: 'Seed executed successfully',
      users: SEED_USERS.length,
      portfolioItems: totalItems,
    };
  }

  /**
   * Removes all seed data in the correct dependency order.
   * Uses explicit DELETEs rather than relying solely on CASCADE to make the
   * operation transparent and auditable.
   */
  async clear(): Promise<{ message: string; deleted: number }> {
    const seedUsers = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM users WHERE email LIKE $1`,
      [`%${SEED_EMAIL_SUFFIX}`],
    );

    if (seedUsers.length === 0) {
      return { message: 'No seed data found', deleted: 0 };
    }

    const userIds = seedUsers.map((u) => u.id);

    await this.dataSource.transaction(async (manager) => {
      // Resolve all portfolio item ids first
      const items = await manager.query<Array<{ id: string }>>(
        `SELECT id FROM portfolio_items WHERE "userId" = ANY($1)`,
        [userIds],
      );
      const itemIds = items.map((i) => i.id);

      if (itemIds.length > 0) {
        await manager.query(
          `DELETE FROM portfolio_tags WHERE "portfolioItemsId" = ANY($1)`,
          [itemIds],
        );
        await manager.query(
          `DELETE FROM portfolio_items WHERE id = ANY($1)`,
          [itemIds],
        );
      }

      await manager.query(`DELETE FROM tags WHERE "userId" = ANY($1)`, [userIds]);
      await manager.query(`DELETE FROM users WHERE id = ANY($1)`, [userIds]);
    });

    return {
      message: 'Seed data cleared',
      deleted: seedUsers.length,
    };
  }
}

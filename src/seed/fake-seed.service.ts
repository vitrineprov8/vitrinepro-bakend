import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as https from 'https';
import * as http from 'http';
import slugify from 'slugify';
import { StorageService } from '../storage/storage.service';

const FAKE_EMAIL_SUFFIX = '@fakeseed.com.br';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto
      .get(url, { headers: { 'User-Agent': 'VitrinePro-Seed/1.0' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow redirect
          resolve(downloadBuffer(res.headers.location));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

function makeSlug(text: string, suffix: string): string {
  return (
    slugify(text, { lower: true, strict: true }).slice(0, 60) +
    '-' +
    suffix.slice(0, 8)
  );
}

/** Convert simple HTML (p, h2) into a TipTap/ProseMirror JSON document. */
function htmlToTipTap(html: string): object {
  const nodes: object[] = [];
  const blockRegex = /<(p|h2)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(html)) !== null) {
    const tag = match[1];
    // Strip any remaining inline HTML tags and decode basic entities
    const text = match[2]
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .trim();

    if (!text) continue;

    if (tag === 'h2') {
      nodes.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text }],
      });
    } else {
      nodes.push({
        type: 'paragraph',
        content: [{ type: 'text', text }],
      });
    }
  }

  if (nodes.length === 0) {
    nodes.push({ type: 'paragraph', content: [{ type: 'text', text: html }] });
  }

  return { type: 'doc', content: nodes };
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const FAKE_USERS = [
  // ── ARQUITETOS ──────────────────────────────────────────────────────────
  {
    firstName: 'Pedro',
    lastName: 'Alves',
    profession: 'Arquiteto',
    location: 'São Paulo, SP',
    bio: 'Arquiteto formado pela USP com 12 anos de experiência em projetos residenciais e comerciais. Especialista em arquitetura sustentável e bioclimática, busco criar espaços que dialoguem com o ambiente e com as necessidades humanas.',
    bannerColor: 'linear-gradient(135deg, #c9a96e 0%, #8B6914 100%)',
    avatarQuery: 'professional+architect+man+portrait',
    avatarUnsplashId: 'photo-1560250097-0b93528c311a',
  },
  {
    firstName: 'Fernanda',
    lastName: 'Monteiro',
    profession: 'Arquiteta e Urbanista',
    location: 'Curitiba, PR',
    bio: 'Arquiteta e urbanista apaixonada por planejamento urbano e habitação social. Doutoranda em arquitetura na UFPR, concilio pesquisa acadêmica com projetos de impacto social nas periferias de Curitiba.',
    bannerColor: 'linear-gradient(135deg, #2d6a4f 0%, #74c69d 100%)',
    avatarQuery: 'professional+woman+architect',
    avatarUnsplashId: 'photo-1573496359142-b8d87734a5a2',
  },
  {
    firstName: 'Rodrigo',
    lastName: 'Figueiredo',
    profession: 'Arquiteto de Interiores',
    location: 'Rio de Janeiro, RJ',
    bio: 'Especialista em design de interiores de alto padrão. Formado pela PUC-Rio, já assinei mais de 200 projetos residenciais e comerciais. Minha abordagem une funcionalidade, estética contemporânea e identidade do cliente.',
    bannerColor: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    avatarQuery: 'professional+interior+designer+man',
    avatarUnsplashId: 'photo-1472099645785-5658abf4ff4e',
  },
  // ── MÉDICOS ──────────────────────────────────────────────────────────────
  {
    firstName: 'Dra. Carla',
    lastName: 'Ribeiro',
    profession: 'Médica Cardiologista',
    location: 'São Paulo, SP',
    bio: 'Cardiologista com residência no InCor e 15 anos de prática clínica. Professora adjunta da FMUSP, dedico-me ao cuidado cardiovascular preventivo e à educação de pacientes sobre hábitos saudáveis.',
    bannerColor: 'linear-gradient(135deg, #c62a2a 0%, #e57373 100%)',
    avatarQuery: 'female+doctor+portrait+professional',
    avatarUnsplashId: 'photo-1559839734-2b71ea197ec2',
  },
  {
    firstName: 'Dr. André',
    lastName: 'Tavares',
    profession: 'Médico Neurologista',
    location: 'Belo Horizonte, MG',
    bio: 'Neurologista clínico especializado em cefaléias e distúrbios do sono. Membro da Academia Brasileira de Neurologia, atendo no Hospital das Clínicas da UFMG e em consultório particular.',
    bannerColor: 'linear-gradient(135deg, #4a0e8f 0%, #9c27b0 100%)',
    avatarQuery: 'male+doctor+professional+portrait',
    avatarUnsplashId: 'photo-1612349317150-e413f6a5b16d',
  },
  // ── ADVOGADOS ────────────────────────────────────────────────────────────
  {
    firstName: 'Dra. Isabela',
    lastName: 'Campos',
    profession: 'Advogada Trabalhista',
    location: 'Brasília, DF',
    bio: 'Advogada com 10 anos de atuação exclusiva em direito do trabalho e previdenciário. Cofundadora do escritório Campos & Associados, defendo trabalhadores e empresas com foco em soluções eficientes e preventivas.',
    bannerColor: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
    avatarQuery: 'professional+female+lawyer+portrait',
    avatarUnsplashId: 'photo-1551836022-d5d88e9218df',
  },
  {
    firstName: 'Dr. Marcelo',
    lastName: 'Nogueira',
    profession: 'Advogado Empresarial',
    location: 'São Paulo, SP',
    bio: 'Especialista em direito societário, contratos e fusões e aquisições. LLM pela FGV Direito SP. Assessoro startups, scale-ups e empresas de médio porte em suas operações societárias e estratégias de crescimento.',
    bannerColor: 'linear-gradient(135deg, #37474f 0%, #546e7a 100%)',
    avatarQuery: 'professional+male+lawyer+suit',
    avatarUnsplashId: 'photo-1519085360753-af0119f7cbe7',
  },
  // ── DESENVOLVEDORES ──────────────────────────────────────────────────────
  {
    firstName: 'Gabriel',
    lastName: 'Nascimento',
    profession: 'Desenvolvedor Backend',
    location: 'Florianópolis, SC',
    bio: 'Desenvolvedor backend com 8 anos de experiência em Node.js, Go e arquiteturas de microsserviços. Open source enthusiast — mantenho bibliotecas com mais de 2k estrelas no GitHub. Apaixonado por performance e sistemas distribuídos.',
    bannerColor: 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #21262d 100%)',
    avatarQuery: 'programmer+developer+man+portrait',
    avatarUnsplashId: 'photo-1507003211169-0a1dd7228f2d',
  },
  {
    firstName: 'Larissa',
    lastName: 'Menezes',
    profession: 'Desenvolvedora Mobile',
    location: 'Porto Alegre, RS',
    bio: 'Desenvolvedora mobile especializada em React Native e Flutter. Já publiquei 15 aplicativos na App Store e Play Store com mais de 500k downloads acumulados. Palestrante em conferências de tecnologia pelo Brasil.',
    bannerColor: 'linear-gradient(135deg, #6200ea 0%, #b388ff 100%)',
    avatarQuery: 'female+developer+tech+portrait',
    avatarUnsplashId: 'photo-1580489944761-15a19d654956',
  },
  {
    firstName: 'Felipe',
    lastName: 'Gomes',
    profession: 'Engenheiro de DevOps',
    location: 'Campinas, SP',
    bio: 'DevOps Engineer com expertise em Kubernetes, Terraform e plataformas cloud (AWS, GCP). Certificado AWS Solutions Architect e CKA. Ajudo times de desenvolvimento a construir pipelines de CI/CD robustos e infraestruturas escaláveis.',
    bannerColor: 'linear-gradient(135deg, #e65100 0%, #ff8a65 100%)',
    avatarQuery: 'tech+engineer+man+professional',
    avatarUnsplashId: 'photo-1500648767791-00dcc994a43e',
  },
  // ── DESIGNERS ────────────────────────────────────────────────────────────
  {
    firstName: 'Letícia',
    lastName: 'Andrade',
    profession: 'UX/UI Designer',
    location: 'São Paulo, SP',
    bio: 'Designer de produto com foco em pesquisa e estratégia. 7 anos de experiência em startups e agências de design. Formada em Design pela ESPM, especialização em UX pela Interaction Design Foundation.',
    bannerColor: 'linear-gradient(135deg, #ff6584 0%, #c62a85 100%)',
    avatarQuery: 'female+designer+creative+portrait',
    avatarUnsplashId: 'photo-1494790108377-be9c29b29330',
  },
  {
    firstName: 'Bruno',
    lastName: 'Carvalho',
    profession: 'Designer Gráfico',
    location: 'Recife, PE',
    bio: 'Designer gráfico e diretor de arte com 9 anos de mercado. Especialista em identidade visual e branding para empresas de médio e grande porte. Atendo clientes em todo o Brasil de forma remota.',
    bannerColor: 'linear-gradient(135deg, #ff8f00 0%, #ffd54f 100%)',
    avatarQuery: 'creative+designer+man+portrait',
    avatarUnsplashId: 'photo-1463453091185-61582044d556',
  },
  // ── CONTADORES ───────────────────────────────────────────────────────────
  {
    firstName: 'Eduardo',
    lastName: 'Pires',
    profession: 'Contador e Consultor Tributário',
    location: 'São Paulo, SP',
    bio: 'Contador com CRC-SP ativo e MBA em Gestão Tributária pela FGV. 14 anos de experiência em planejamento fiscal para empresas do Simples Nacional, Lucro Presumido e Lucro Real. Especialista em redução legal de carga tributária.',
    bannerColor: 'linear-gradient(135deg, #004d40 0%, #00897b 100%)',
    avatarQuery: 'accountant+professional+man+portrait',
    avatarUnsplashId: 'photo-1560250097-0b93528c311a',
  },
  {
    firstName: 'Patrícia',
    lastName: 'Duarte',
    profession: 'Contadora e Gestora Financeira',
    location: 'Porto Alegre, RS',
    bio: 'Contadora especializada em gestão financeira para pequenas e médias empresas. Fundadora da Duarte Contabilidade, atendo mais de 80 clientes com foco em regularidade fiscal e saúde financeira do negócio.',
    bannerColor: 'linear-gradient(135deg, #0277bd 0%, #03a9f4 100%)',
    avatarQuery: 'female+accountant+professional+business',
    avatarUnsplashId: 'photo-1573496359142-b8d87734a5a2',
  },
] as const;

// ---------------------------------------------------------------------------
// Portfolio items per profession
// ---------------------------------------------------------------------------

type FakeProjectSeed = {
  title: string;
  subtitle: string;
  contentHtml: string;
  tags: string[];
  year: number;
  projectStatus: 'ONGOING' | 'COMPLETED';
  coverUnsplashId: string;
};

const PROJECTS_BY_PROFESSION: Record<string, FakeProjectSeed[]> = {
  Arquiteto: [
    {
      title: 'Residência Contemporânea em São Paulo',
      subtitle: 'Casa unifamiliar de 380m² no Morumbi',
      contentHtml: `<p>Este projeto residencial no bairro Morumbi representa minha abordagem de integração entre espaços internos e externos. O terreno de 800m² com desnível de 4 metros foi tratado como oportunidade para criar patamares que ampliam a sensação de amplitude.</p><p>O programa inclui cinco suítes, living integrado à piscina com borda infinita, adega climatizada e home theater. A fachada em concreto aparente combinado com painéis de madeira cumaru resiste ao clima paulistano e exige baixa manutenção.</p><p>A estratégia bioclimática foi fundamental: beiral de 1,8m na orientação norte protege os interiores do sol de verão, enquanto permite a entrada de luz nos meses frios. Captação de água pluvial abastece a irrigação do jardim e o reaproveitamento de água cinza alimenta as descargas sanitárias, reduzindo o consumo em 40%.</p><p>A obra durou 18 meses com equipe especializada de 30 profissionais. O resultado é uma residência que equilibra privacidade, conforto e conexão com a natureza.</p>`,
      tags: ['Arquitetura Residencial', 'Sustentabilidade', 'Concreto Aparente'],
      year: 2024,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1564013799919-ab600027ffc6',
    },
    {
      title: 'Retrofit Comercial — Edifício Anos 70',
      subtitle: 'Revitalização de laje corporativa de 2.400m²',
      contentHtml: `<p>O desafio deste projeto foi modernizar uma laje corporativa dos anos 70 sem comprometer a estrutura original. O edifício, tombado pelo patrimônio histórico municipal, exigiu um diálogo cuidadoso entre preservação e atualização funcional.</p><p>O plano diretor manteve os pilares e vigas originais em concreto aparente, integrando-os ao novo design como elementos estéticos. O pé-direito de 3,6m foi aproveitado para instalação de mezanino metálico em 30% da área, criando espaços diferenciados de trabalho colaborativo.</p><p>A atualização das instalações hidráulicas, elétricas e de ar condicionado foi realizada com mínima interferência na estrutura. O sistema de HVAC de alta eficiência reduziu o consumo energético do edifício em 35% em comparação com o sistema anterior.</p><p>O projeto recebeu certificação AQUA-HQE na categoria reformas, sendo um dos primeiros edifícios históricos de São Paulo a obter esta certificação ambiental.</p>`,
      tags: ['Arquitetura Comercial', 'Retrofit', 'Patrimônio Histórico'],
      year: 2023,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1486325212027-8081e485255e',
    },
    {
      title: 'Condomínio Sustentável — Fase 1',
      subtitle: '48 unidades habitacionais com infraestrutura verde',
      contentHtml: `<p>Projeto de desenvolvimento residencial multifamiliar com foco em sustentabilidade e qualidade de vida. As 48 unidades distribuídas em 6 blocos de 8 andares foram posicionadas para maximizar ventilação cruzada e insolação adequada.</p><p>Cada unidade conta com varanda de 12m², painel solar individual e pontos de recarga para veículos elétricos. O condomínio possui horta comunitária, telhado verde extensivo e sistema de compostagem que atende 70% das necessidades do jardim compartilhado.</p><p>A paisagem, assinada por escritório especializado, prioriza espécies nativas do cerrado e mata atlântica, reduzindo consumo de água e atraindo fauna local. O projeto encontra-se em execução com previsão de entrega no segundo semestre de 2025.</p>`,
      tags: ['Arquitetura Residencial', 'Sustentabilidade', 'Multifamiliar'],
      year: 2024,
      projectStatus: 'ONGOING',
      coverUnsplashId: 'photo-1545043023-6a61e44f8e89',
    },
  ],
  'Arquiteta e Urbanista': [
    {
      title: 'Plano de Mobilidade — Centro Histórico',
      subtitle: 'Requalificação de calçadas e ciclovias em 12km',
      contentHtml: `<p>Este projeto de mobilidade urbana foi desenvolvido em parceria com a Prefeitura de Curitiba para requalificar o sistema de circulação do centro histórico. O estudo de 18 meses envolveu contagens de fluxo, entrevistas com moradores, comerciantes e usuários de transporte público.</p><p>A proposta contempla alargamento de 40 calçadas em trechos críticos, implantação de 12km de ciclovias protegidas, 3 novas praças de convívio e 200 vagas de estacionamento para bicicletas. A arborização urbana adicional prevê 800 árvores de médio porte para conforto térmico dos pedestres.</p><p>O projeto piloto implementado em duas quadras demonstrou aumento de 45% no tempo de permanência dos pedestres e crescimento de 23% no faturamento do comércio local, segundo pesquisa da Câmara de Dirigentes Lojistas.</p>`,
      tags: ['Urbanismo', 'Mobilidade Urbana', 'Planejamento Urbano'],
      year: 2023,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1477959858617-67f85cf4f1df',
    },
    {
      title: 'Habitação Social — Vila Nova Curitiba',
      subtitle: '120 unidades para famílias de baixa renda',
      contentHtml: `<p>Projeto de habitação de interesse social desenvolvido com financiamento do MCMV para atender 120 famílias com renda de até 3 salários mínimos. O desenvolvimento metodológico incluiu 8 rodadas de participação comunitária para definição do programa e das prioridades de projeto.</p><p>As unidades de 45m² foram organizadas em 10 blocos de 12 apartamentos, com espaços de convivência no térreo, praça central, quadra poliesportiva e pequeno centro comunitário multiuso. A escala humana dos blocos evita a sensação de conjunto habitacional massificado.</p><p>Inovação técnica: uso de painéis de concreto pré-fabricado local, reduzindo prazo de obra em 30% e gerando 40 empregos diretos na comunidade. O projeto foi premiado pelo IAB-PR como melhor projeto de habitação social de 2023.</p>`,
      tags: ['Habitação Social', 'Arquitetura Residencial', 'Urbanismo'],
      year: 2023,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1582407947304-fd86f028f716',
    },
  ],
  'Arquiteto de Interiores': [
    {
      title: 'Apartamento Minimalista — Ipanema',
      subtitle: '180m² com paleta neutra e materiais nobres',
      contentHtml: `<p>Projeto de interiores para apartamento de alto padrão em Ipanema com vista para o mar. O cliente, um executivo de finanças que divide tempo entre Rio e Nova York, pediu um espaço que remete à serenidade de uma galeria de arte contemporânea.</p><p>A paleta restrita a brancos, cinzas e madeiras naturais foi aplicada com rigor. O revestimento de mármore Statuário percorre piso, bancada da cozinha e o painel da sala de estar, criando continuidade visual. Os móveis, com exceção dos sofás italianos, foram todos desenhados exclusivamente para o projeto.</p><p>A iluminação, projeto separado com engenheiro especializado, usa 100% LEDs com controle por automação. Três camadas de luz — geral, de tarefa e de destaque — criam ambientes completamente diferentes para dia e noite.</p><p>O prazo de execução foi de 9 meses, com equipe de 15 profissionais e fornecedores selecionados. O resultado é um apartamento que parece revista, mas que funciona perfeitamente no dia a dia.</p>`,
      tags: ['Design de Interiores', 'Residencial Premium', 'Minimalismo'],
      year: 2024,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1586023492125-27b2c045efd7',
    },
    {
      title: 'Restaurante Japonês Contemporâneo',
      subtitle: 'Experiência imersiva para 60 lugares',
      contentHtml: `<p>O cliente queria um restaurante japonês que não fosse óbvio — sem estereótipos de papel de parede de cerejeiras ou lanternas de papel. O resultado é um espaço que traduz a estética japonesa de forma contemporânea e sofisticada.</p><p>A madeira de carvalho defumado cobre paredes e teto do ambiente principal, criando uma caixa acolhedora e intimista. As mesas em granito escuro foram desenhadas com detalhes em latão oxidado. O balcão de sushi em mármore negro de 8 metros é o ponto focal do espaço.</p><p>Iluminação pendente customizada com papéis artesanais japoneses filtram uma luz quente e acolhedora. O sistema acústico com painéis de madeira perfurada garante conversas confortáveis mesmo com o restaurante cheio.</p><p>O projeto foi concluído em 5 meses e o restaurante recebeu menção especial na revista Veja Rio no mês de abertura.</p>`,
      tags: ['Design de Interiores', 'Food Service', 'Gastronomia'],
      year: 2023,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1517248135467-4c7edcad34c4',
    },
  ],
  'Médica Cardiologista': [
    {
      title: 'Hipertensão Arterial: O Guia Completo',
      subtitle: 'Tudo que você precisa saber para controlar a pressão',
      contentHtml: `<p>A hipertensão arterial sistêmica (HAS) afeta mais de 36 milhões de brasileiros e é o principal fator de risco para infarto do miocárdio e acidente vascular cerebral. Apesar de sua prevalência, a maioria dos hipertensos não sabe que tem a doença — daí o apelido de "assassino silencioso".</p><h2>O que é pressão arterial?</h2><p>A pressão arterial é a força que o sangue exerce sobre as paredes das artérias ao circular pelo corpo. É medida em dois valores: sistólica (quando o coração contrai) e diastólica (quando o coração relaxa). Valores normais ficam abaixo de 120/80 mmHg para adultos.</p><h2>Quando se torna hipertensão?</h2><p>Considera-se hipertensão quando a pressão sistólica está igual ou acima de 140 mmHg e/ou a diastólica igual ou acima de 90 mmHg, medidas em pelo menos duas ocasiões diferentes. O diagnóstico requer confirmação — uma única medição elevada não é suficiente.</p><h2>Fatores de risco modificáveis</h2><p>Excesso de sódio na alimentação, sedentarismo, obesidade, tabagismo, consumo excessivo de álcool e estresse crônico são fatores que você pode controlar. Reduzir o consumo de sal para menos de 5g por dia (uma colher de chá) pode diminuir a pressão sistólica em até 5 mmHg.</p><h2>Tratamento</h2><p>O tratamento combina mudanças no estilo de vida com medicação quando necessário. Atividade física regular — pelo menos 150 minutos por semana de intensidade moderada — é tão eficaz quanto alguns medicamentos em casos leves. A decisão sobre iniciar medicação é sempre individualizada pelo médico.</p><p>Lembre-se: hipertensão tem controle. Com acompanhamento médico adequado e mudanças de hábito, é possível ter uma vida plena e saudável.</p>`,
      tags: ['Cardiologia', 'Hipertensão', 'Saúde Cardiovascular'],
      year: 2024,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1576091160399-112ba8d25d1d',
    },
    {
      title: 'Coração Saudável Após os 50: O Que Muda',
      subtitle: 'Cuidados cardiovasculares para a meia-idade',
      contentHtml: `<p>Após os 50 anos, o risco cardiovascular aumenta significativamente — especialmente para mulheres após a menopausa e para homens que negligenciaram a saúde nas décadas anteriores. A boa notícia é que nunca é tarde para agir.</p><h2>Por que o risco aumenta?</h2><p>Com o envelhecimento, as artérias perdem elasticidade, o coração trabalha com menor eficiência e o metabolismo muda. A menopausa retira o efeito protetor do estrogênio nas artérias femininas, equiparando o risco cardiovascular entre homens e mulheres após os 65 anos.</p><h2>Exames essenciais</h2><p>A partir dos 40-50 anos, recomendo check-up cardiovascular anual incluindo: eletrocardiograma, ecocardiograma (a cada 2-3 anos), teste ergométrico, perfil lipídico completo, glicemia e hemoglobina glicada, e pressão arterial monitorada.</p><h2>Exercício: o melhor remédio</h2><p>A prática regular de exercícios aeróbicos reduz o risco de morte cardiovascular em até 35%. Caminhada, natação, ciclismo e dança são excelentes opções para quem está começando ou retornando à atividade física após os 50. Sempre com avaliação médica antes de iniciar.</p><h2>Alimentação cardioprotetora</h2><p>Dieta mediterrânea — rica em azeite de oliva, peixes, legumes, frutas e castanhas — reduz eventos cardiovasculares em 30% segundo grandes estudos. Reduzir ultraprocessados e gorduras trans é igualmente importante.</p>`,
      tags: ['Cardiologia', 'Envelhecimento Saudável', 'Prevenção'],
      year: 2024,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1505751172876-fa1923c5c528',
    },
  ],
  'Médico Neurologista': [
    {
      title: 'Enxaqueca: Muito Além da "Dor de Cabeça"',
      subtitle: 'Entendendo e tratando a enxaqueca na prática',
      contentHtml: `<p>A enxaqueca é a terceira doença mais prevalente do mundo e a segunda causa mais comum de incapacidade. Apesar disso, é frequentemente subestimada, tanto por pacientes quanto por profissionais de saúde não especializados. Mais de 30 milhões de brasileiros convivem com esta condição.</p><h2>O que é enxaqueca?</h2><p>Enxaqueca (ou migrânea) é uma doença neurológica caracterizada por crises recorrentes de cefaleia intensa, geralmente unilateral e pulsátil, acompanhada de náusea, vômito e sensibilidade à luz e ao som. As crises duram de 4 a 72 horas e comprometem significativamente a qualidade de vida.</p><h2>Gatilhos comuns</h2><p>Cada paciente tem seus gatilhos específicos, mas os mais frequentes incluem: alterações no padrão de sono, jejum prolongado, estresse emocional, variações hormonais (especialmente em mulheres), determinados alimentos (vinho tinto, queijos maturados, glutamato monossódico), mudanças climáticas e exposição à luz forte.</p><h2>Diagnóstico</h2><p>O diagnóstico é clínico, baseado na história do paciente e nos critérios da Classificação Internacional das Cefaléias (ICHD-3). Exames de imagem são solicitados apenas para afastar causas secundárias. Um diário de cefaleia é ferramenta fundamental tanto para diagnóstico quanto para monitoramento do tratamento.</p><h2>Tratamento moderno</h2><p>Temos hoje medicamentos específicos e altamente eficazes. Os triptanos são a base do tratamento das crises. Para prevenção, além de medicamentos clássicos como topiramato e amitriptilina, temos os anticorpos monoclonais anti-CGRP — revolução no tratamento preventivo da enxaqueca crônica. Neuromodulação não invasiva também é opção para casos refratários.</p>`,
      tags: ['Neurologia', 'Enxaqueca', 'Cefaleia'],
      year: 2024,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1559757175-5700dde675bc',
    },
    {
      title: 'Distúrbios do Sono: Quando Dormir Mal é Doença',
      subtitle: 'Insônia, apneia e síndrome das pernas inquietas',
      contentHtml: `<p>Dormir mal é epidemia no Brasil moderno. Estima-se que 73 milhões de brasileiros sofram de insônia e 10 milhões tenham apneia obstrutiva do sono não diagnosticada. A privação de sono não é apenas desconforto — é fator de risco independente para doenças cardiovasculares, diabetes, obesidade, depressão e demência.</p><h2>Insônia: mais que falta de sono</h2><p>Insônia é a dificuldade em iniciar ou manter o sono, ou acordar muito cedo, com consequências no funcionamento diurno. É considerada crônica quando ocorre três ou mais vezes por semana por pelo menos três meses. O tratamento de primeira linha é a Terapia Cognitivo-Comportamental para Insônia (TCC-I), mais eficaz que medicamentos a longo prazo.</p><h2>Apneia obstrutiva do sono</h2><p>Caracterizada por pausas na respiração durante o sono, a apneia compromete a oxigenação cerebral repetidamente. Ronco alto, sensação de sufocamento ao acordar, sonolência diurna excessiva e dores de cabeça matinais são sinais de alerta. O diagnóstico é feito por polissonografia e o tratamento principal é o CPAP.</p><h2>Síndrome das pernas inquietas</h2><p>Sensação desagradável nas pernas que piora em repouso e melhora com movimento — especialmente à noite. Afeta 5% da população e tem causa genética identificada em muitos casos. Deficiência de ferro pode ser fator precipitante tratável.</p><p>Se você tem problemas de sono há mais de um mês, consulte um neurologista ou especialista em medicina do sono. Não subestime a importância de dormir bem.</p>`,
      tags: ['Neurologia', 'Distúrbios do Sono', 'Insônia'],
      year: 2023,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1541781774459-bb2af2f05b55',
    },
  ],
  'Advogada Trabalhista': [
    {
      title: 'Home Office e Direitos Trabalhistas: O Que Mudou',
      subtitle: 'Guia completo sobre teletrabalho após a Reforma Trabalhista',
      contentHtml: `<p>O teletrabalho deixou de ser exceção e tornou-se realidade permanente em milhares de empresas brasileiras. Com isso, surgiram dúvidas importantes sobre direitos e obrigações de empregados e empregadores. Neste artigo, esclarecemos os principais pontos.</p><h2>O que diz a CLT sobre teletrabalho?</h2><p>A Reforma Trabalhista de 2017 incluiu o teletrabalho na CLT (artigos 75-A a 75-E). A regulamentação foi complementada pela Lei nº 14.442/2022, que trouxe mais clareza sobre o regime híbrido e as responsabilidades das partes. O contrato deve especificar explicitamente as atividades realizadas em teletrabalho.</p><h2>Controle de jornada</h2><p>Este é o ponto mais sensível. Empregados em regime de teletrabalho puro estão excluídos das regras de controle de jornada do artigo 62, inciso III da CLT — o que significa que, em tese, não têm direito a horas extras. No entanto, decisões recentes do TST têm reconhecido horas extras quando o empregador mantém controle efetivo da jornada via ferramentas digitais.</p><h2>Custos de infraestrutura</h2><p>A lei exige que o contrato especifique quem arca com os custos de infraestrutura — internet, energia, equipamentos. Na ausência de previsão, jurisprudência dominante responsabiliza o empregador. Valores pagos pelo empregador a título de auxílio home office não integram o salário e não têm natureza salarial.</p><h2>Acidente de trabalho em home office</h2><p>O acidente ocorrido durante o horário de trabalho e no exercício das atividades laborais é considerado acidente de trabalho, mesmo em home office. Entretanto, a responsabilidade é mais complexa de estabelecer. Recomendo que empregadores documentem claramente as condições do ambiente de trabalho aprovadas.</p>`,
      tags: ['Direito Trabalhista', 'Teletrabalho', 'CLT'],
      year: 2024,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1593642632559-0c6d3fc62b89',
    },
    {
      title: 'Rescisão de Contrato: Conheça Todos os Seus Direitos',
      subtitle: 'Do aviso prévio às verbas rescisórias — guia prático',
      contentHtml: `<p>A rescisão do contrato de trabalho gera direitos e obrigações para ambas as partes. Conhecer suas verbas rescisórias é fundamental para não ser prejudicado em um momento já difícil. Este guia cobre as principais modalidades de rescisão.</p><h2>Demissão sem justa causa</h2><p>Quando o empregador demite sem justa causa, o trabalhador tem direito a: saldo de salário, aviso prévio (trabalhado ou indenizado), 13º salário proporcional, férias vencidas e proporcionais acrescidas de 1/3, multa de 40% do FGTS depositado, guias do seguro-desemprego e liberação do FGTS.</p><h2>Pedido de demissão</h2><p>Ao pedir demissão, o trabalhador perde direito ao seguro-desemprego, à multa de 40% do FGTS e à retirada do fundo — exceto em situações específicas como aposentadoria. Deve cumprir aviso prévio (30 dias para menos de 1 ano; acrescido de 3 dias por ano trabalhado, até 90 dias).</p><h2>Acordo de rescisão (§ 6º do art. 484-A da CLT)</h2><p>Introduzida pela Reforma Trabalhista, a rescisão por acordo permite que empregado e empregador negociem a saída. O empregador paga 20% de multa do FGTS (em vez de 40%) e o trabalhador saca 80% do fundo — sem direito a seguro-desemprego. É alternativa interessante para quem já tem novo emprego garantido.</p><h2>Prazo para pagamento</h2><p>O empregador tem até 10 dias corridos após o término do contrato para quitar as verbas rescisórias. O descumprimento gera multa de um salário ao trabalhador.</p>`,
      tags: ['Direito Trabalhista', 'Rescisão Trabalhista', 'FGTS'],
      year: 2024,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1589829545856-d10d557cf95f',
    },
  ],
  'Advogado Empresarial': [
    {
      title: 'LGPD na Prática: O Que Sua Empresa Precisa Fazer Agora',
      subtitle: 'Guia de adequação à Lei Geral de Proteção de Dados',
      contentHtml: `<p>A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) está em plena vigência e a ANPD já aplicou as primeiras sanções a empresas brasileiras. Se sua empresa ainda não se adequou, este é o momento de agir — as multas chegam a R$ 50 milhões por infração.</p><h2>Quem precisa se adequar?</h2><p>Toda empresa que coleta, armazena, usa ou compartilha dados pessoais de pessoas físicas no Brasil — independente do tamanho ou setor. Isso inclui dados de clientes, funcionários, fornecedores e parceiros comerciais. Não há exceção para pequenas empresas, mas há proporcionalidade nas sanções.</p><h2>Passos essenciais para adequação</h2><p>O primeiro passo é o mapeamento de dados (data mapping): identificar quais dados pessoais a empresa trata, para quê, com base em qual fundamento legal e por quanto tempo. Sem esse mapeamento, é impossível garantir conformidade.</p><p>Em seguida, é necessário revisar contratos com fornecedores que acessam dados (operadores), criar política de privacidade atualizada, estabelecer canal de atendimento a titulares de dados e nomear um DPO (Encarregado de Proteção de Dados).</p><h2>Incidentes de segurança</h2><p>A LGPD exige comunicação à ANPD e aos titulares afetados em caso de incidente de segurança que possa acarretar risco. O prazo é de 2 dias úteis após o conhecimento do incidente. Ter um plano de resposta a incidentes documentado é obrigação mínima.</p><h2>Sanções</h2><p>As penalidades incluem advertência, multa de até 2% do faturamento (limitada a R$ 50 milhões por infração), publicização da infração, bloqueio e eliminação dos dados pessoais envolvidos. A adequação é investimento, não custo.</p>`,
      tags: ['Direito Digital', 'LGPD', 'Direito Empresarial'],
      year: 2024,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1450101499163-c8848c66ca85',
    },
    {
      title: 'Contrato Social: Erros que Custam Caro às Empresas',
      subtitle: 'Os principais problemas societários e como evitá-los',
      contentHtml: `<p>O contrato social é a constituição da empresa — e como toda constituição, quando mal redigido ou desatualizado, gera conflitos que podem ser fatais para o negócio. Em 12 anos de assessoria empresarial, identifiquei os erros mais recorrentes e custosos.</p><h2>Divisão de cotas sem critério</h2><p>50/50 entre dois sócios parece justo, mas é receita para paralisia decisória. Qualquer decisão relevante exige unanimidade, e quando há discordância, a empresa trava. Recomendo sempre definir sócio majoritário ou mecanismos claros de desempate.</p><h2>Ausência de acordo de sócios</h2><p>O contrato social regula a empresa; o acordo de sócios regula a relação entre os sócios. Sem acordo de sócios, questões como venda de participação, direito de preferência, cláusula de não concorrência, vesting e saída do sócio ficam sem disciplina clara — gerando conflitos judiciais longos e caros.</p><h2>Capital social inadequado</h2><p>Capital social simbólico (R$ 1.000,00 para empresa de R$ 5 milhões de faturamento) cria problemas de credibilidade com fornecedores e bancos, e pode ser questionado em responsabilidade civil. O capital deve refletir minimamente a realidade econômica da empresa.</p><h2>Não atualizar o contrato social</h2><p>Empresa que cresceu, mudou de ramo, incluiu novos sócios ou alterou a administração sem atualizar o contrato social opera em situação irregular. A Junta Comercial requer registro de qualquer alteração relevante. Contratos desatualizados geram insegurança jurídica e podem invalidar atos da empresa.</p>`,
      tags: ['Direito Empresarial', 'Sociedades', 'Contratos'],
      year: 2023,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1507679799987-c73779587ccf',
    },
  ],
  'Desenvolvedor Backend': [
    {
      title: 'Clean Architecture com NestJS: Guia Definitivo',
      subtitle: 'Organizando seu projeto para escalar com manutenibilidade',
      contentHtml: `<p>Clean Architecture não é sobre ferramentas — é sobre separação de responsabilidades. Quando aplicada corretamente ao NestJS, resulta em código que você consegue testar, modificar e escalar sem aquele medo de quebrar tudo. Neste artigo, compartilho o modelo que uso em produção há 3 anos.</p><h2>Por que Clean Architecture?</h2><p>Projetos NestJS tendem a crescer para uma bagunça de serviços gigantes que fazem tudo. Quando o DevOps altera o banco de dados ou você precisa migrar de REST para GraphQL, o custo de mudança é alto. A Clean Architecture resolve isso garantindo que regras de negócio não dependam de frameworks, bancos de dados ou protocolos de comunicação.</p><h2>A estrutura que uso</h2><p>Organizo o projeto em camadas concêntricas: Domain (entidades e regras de negócio puras), Application (use cases e interfaces de repositório), Infrastructure (implementações concretas: TypeORM, S3, EmailService) e Presentation (controllers, DTOs, validação). Cada camada só pode depender de camadas mais internas.</p><h2>Exemplo prático: criando um use case</h2><p>O use case CreateUser recebe um DTO via interface, chama o repositório via interface, publica um evento de domínio e retorna. Ele não sabe nada sobre Express, TypeORM ou NestJS. Isso significa que posso testá-lo com mocks simples, sem subir container de banco.</p><h2>Injeção de dependência no NestJS</h2><p>O módulo de DI do NestJS facilita muito a implementação: registro a interface como token (string ou Symbol) e forneço a implementação concreta. Nos testes, forneço o mock. A inversão de dependência fica natural com o useValue e useClass dos providers.</p><p>O repositório com este template está disponível no meu GitHub — deixo o link nos comentários.</p>`,
      tags: ['NestJS', 'Arquitetura', 'Backend', 'TypeScript'],
      year: 2024,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1542831371-29b0f74f9713',
    },
    {
      title: 'PostgreSQL Full-Text Search vs Elasticsearch: Quando Usar Cada Um',
      subtitle: 'Análise técnica comparativa para projetos reais',
      contentHtml: `<p>Esta é uma das perguntas mais recorrentes que recebo: "Preciso de busca avançada, devo usar Elasticsearch ou posso ficar no Postgres?" A resposta honesta é: depende, e provavelmente você não precisa do Elasticsearch tão cedo quanto pensa.</p><h2>O que o PostgreSQL oferece</h2><p>O Postgres tem suporte nativo a full-text search com índices GIN, ranking por relevância (ts_rank), suporte a múltiplos idiomas, busca por similaridade com pg_trgm e até busca semântica com pgvector. Para a maioria dos projetos com menos de 10 milhões de registros, isso é mais do que suficiente.</p><h2>Vantagens do Postgres FTS</h2><p>Zero infraestrutura adicional. Consistência imediata (sem lag de indexação). Transações ACID. Joins com outros dados. Manutenção simples. Custo zero de operação adicional. Para um time pequeno ou startup, esses fatores são decisivos.</p><h2>Quando o Elasticsearch faz sentido</h2><p>Elasticsearch brilha com volumes acima de dezenas de milhões de documentos, busca multi-tenant complexa, analytics em tempo real, autocompletion sofisticado e sharding horizontal. Se seu produto tem search como feature core (e-commerce de grande escala, plataforma de conteúdo com milhões de artigos), o investimento em Elastic se justifica.</p><h2>Minha recomendação</h2><p>Comece com PostgreSQL FTS + pg_trgm. Instrumente, meça latência e qualidade dos resultados. Só migre para Elastic quando os limites do Postgres se tornarem problemas reais mensuráveis — não hipotéticos.</p>`,
      tags: ['PostgreSQL', 'Elasticsearch', 'Backend', 'Banco de Dados'],
      year: 2024,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1558494949-ef010cbdcc31',
    },
  ],
  'Desenvolvedora Mobile': [
    {
      title: 'React Native vs Flutter em 2025: A Verdade Sem Hype',
      subtitle: 'Comparação honesta baseada em projetos reais',
      contentHtml: `<p>Já trabalhei com React Native desde a versão 0.60 e com Flutter desde o beta. Hoje tenho apps publicados com as duas tecnologias em produção. Neste artigo, falo sem filtros sobre o que cada uma entrega de verdade.</p><h2>Performance</h2><p>Flutter ganhou este round. O motor Impeller eliminou os jank e stutters que eram marca registrada do Flutter antigo. O rendering direto sem bridge JavaScript resulta em 60fps consistentes mesmo em animações complexas. React Native com a Nova Arquitetura (Fabric + JSI) melhorou muito, mas ainda há casos onde a bridge aparece.</p><h2>Ecossistema e bibliotecas</h2><p>React Native vence aqui. Por ser JavaScript/TypeScript, você herda o ecossistema npm inteiro. Bibliotecas como React Query, Zustand e Reanimated são excelentes. No Flutter, o pub.dev cresce rapidamente mas ainda há lacunas em integrações com SDKs nativos específicos.</p><h2>Experiência de desenvolvimento</h2><p>Hot reload de ambos é excelente hoje. O DX do Flutter com null safety e o sistema de tipos do Dart é mais robusto. Para times com background JavaScript, React Native tem curva de aprendizado menor. Para times novos ou que valorizam robustez de linguagem, Flutter é melhor.</p><h2>Minha escolha em 2025</h2><p>Para apps com UI muito customizada e animações pesadas: Flutter. Para apps que precisam de integração com muitas libs JavaScript e times com background web: React Native. Para clientes corporativos que precisam de manutenibilidade: Flutter, pela tipagem mais rígida.</p>`,
      tags: ['React Native', 'Flutter', 'Mobile', 'Desenvolvimento Mobile'],
      year: 2025,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1512941937669-90a1b58e7e9c',
    },
    {
      title: 'App Store Optimization: Como Aumentei Downloads em 300%',
      subtitle: 'Estratégias de ASO que funcionaram nos meus apps',
      contentHtml: `<p>Desenvolver um ótimo app é metade do trabalho. A outra metade é fazer as pessoas descobrirem ele. App Store Optimization (ASO) é o SEO das lojas de apps — e quando feito corretamente, pode multiplicar seus downloads sem gastar um centavo em publicidade.</p><h2>O que é ASO?</h2><p>ASO é o processo de otimizar a página do seu app nas lojas (App Store e Google Play) para aumentar visibilidade nas buscas e converter visitantes em downloads. Os fatores incluem: nome do app, subtítulo, descrição, palavras-chave, screenshots, ícone, avaliações e reviews.</p><h2>Pesquisa de palavras-chave</h2><p>Esta é a base. Use ferramentas como AppFollow, Sensor Tower ou AppTweak para identificar termos com alto volume de busca e baixa competição. Foque em long-tail keywords específicas para seu nicho — é mais fácil ranquear para "app de treino para iniciantes" do que para "app de treino".</p><h2>Screenshots que convertem</h2><p>Seus screenshots são o maior fator de conversão. Teste A/B é obrigatório. Descobri que screenshots com texto explicativo sobreposto aumentam conversão em 40% em comparação com capturas de tela puras. A primeira imagem é crítica — ela aparece nos resultados de busca.</p><h2>Reviews: como gerenciar</h2><p>Peça reviews no momento certo: após o usuário completar uma ação de sucesso, não aleatoriamente. Responda TODOS os reviews negativos com empatia e informação. Reviews respondidos melhoram a percepção de qualidade e influenciam o algoritmo das lojas.</p>`,
      tags: ['Mobile', 'ASO', 'App Store', 'Marketing Digital'],
      year: 2024,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1551650975-87deedd944c3',
    },
  ],
  'Engenheiro de DevOps': [
    {
      title: 'Kubernetes para Desenvolvedores: Do Zero ao Deploy',
      subtitle: 'Guia prático sem exageros de complexidade',
      contentHtml: `<p>Kubernetes assusta pela quantidade de conceitos novos: Pods, Deployments, Services, Ingress, ConfigMaps, Secrets, PersistentVolumes... A curva de aprendizado é real, mas o núcleo do Kubernetes que você usa 90% do tempo é bem mais simples. Este guia cobre exatamente isso.</p><h2>Por que Kubernetes?</h2><p>Docker compose é ótimo para desenvolvimento local, mas em produção você precisa de: alta disponibilidade (múltiplas réplicas), rollout sem downtime, autoscaling baseado em carga, service discovery automático, gerenciamento de segredos e recuperação automática de falhas. Kubernetes resolve tudo isso.</p><h2>Os recursos que você vai usar sempre</h2><p>Deployment: define como seu app roda — quantas réplicas, qual imagem, estratégia de update. Service: expõe seu Deployment na rede do cluster. Ingress: roteamento HTTP externo (pense em nginx configurado automaticamente). ConfigMap e Secret: configuração e credenciais sem hardcode na imagem.</p><h2>Estratégia de deploy sem downtime</h2><p>Use RollingUpdate com maxUnavailable: 0 e maxSurge: 1. Kubernetes vai subir nova versão antes de derrubar a antiga. Combine com readinessProbe bem configurado para garantir que o tráfego só vai para pods saudáveis. Adicione preStop hook com sleep de 15 segundos para drenagem de conexões.</p><h2>Ferramentas que uso no dia a dia</h2><p>k9s para visualizar o cluster no terminal (obrigatório), kubectl com aliases configurados, Helm para gerenciar charts de terceiros, ArgoCD para GitOps e Lens como alternativa visual ao k9s. Com essas 5 ferramentas você opera qualquer cluster.</p>`,
      tags: ['Kubernetes', 'DevOps', 'Cloud', 'Docker'],
      year: 2024,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1518770660439-4636190af475',
    },
    {
      title: 'Terraform na AWS: Infraestrutura como Código que Funciona',
      subtitle: 'Padrões e armadilhas após 5 anos usando Terraform em produção',
      contentHtml: `<p>Terraform é a melhor ferramenta para IaC hoje — mas tem suas armadilhas. Depois de 5 anos usando em projetos de todos os tamanhos, cataloguei os padrões que funcionam e os erros que se repetem.</p><h2>Estrutura de repositório</h2><p>Evite o monorepo de Terraform com tudo junto. Separe por ambiente (dev, staging, prod) e por componente (networking, databases, applications). Use workspaces com cuidado — eles complicam mais do que ajudam na maioria dos casos. Prefira diretórios separados com state remoto no S3.</p><h2>Módulos: quando criar e quando não criar</h2><p>Módulos são poderosos, mas só valem quando o recurso é reutilizado em 3 ou mais lugares. Módulo prematuro é abstração desnecessária. Comece com código direto, extraia módulos quando a duplicação se tornar real. Versione seus módulos com tags Git — nunca aponte para branch main.</p><h2>State remoto e locking</h2><p>State local é armadilha. Desde o primeiro dia, use S3 + DynamoDB para state remoto com locking. Evita conflitos em times e garante que o state não se perca. Configure backend encryption e versionamento do bucket S3.</p><h2>O maior erro: não usar plan em produção</h2><p>terraform apply direto em produção é perigoso. Sempre terraform plan → revisão humana → terraform apply. Em pipelines CI/CD, use o padrão plan no PR e apply no merge para main. Ferramentas como Atlantis ou Spacelift automatizam este fluxo.</p>`,
      tags: ['Terraform', 'AWS', 'DevOps', 'Infraestrutura como Código'],
      year: 2023,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1451187580459-43490279c0fa',
    },
  ],
  'UX/UI Designer': [
    {
      title: 'Design System do Zero: Lições de Quem Construiu Três',
      subtitle: 'O que aprendi construindo design systems em startups e grandes empresas',
      contentHtml: `<p>Um design system bem construído é multiplicador de produtividade. Mal construído, é uma burocracia que ninguém usa. Construí três design systems do zero — um em startup de 15 pessoas, um em escale-up de 200 e um em empresa com 3.000 funcionários. O que aprendi é diferente do que os tutoriais ensinam.</p><h2>Comece menor do que você pensa</h2><p>O erro mais comum: tentar construir o design system completo antes de lançar. Você não sabe quais componentes são realmente necessários até o produto estar em uso. Comece com 10-15 componentes fundamentais (button, input, card, modal, toast), entregue rápido e expanda com base em demanda real.</p><h2>Tokens antes de componentes</h2><p>Design tokens são a fundação. Defina primeiro: paleta de cores com semântica (não apenas azul-500, mas cor-primaria, cor-danger, cor-surface), escala tipográfica, espaçamento baseado em múltiplos de 4px e breakpoints. Componentes construídos sobre tokens são mais consistentes e fáceis de tematizar.</p><h2>Documentação que as pessoas leem</h2><p>Documentação com 50 páginas não é lida. Cada componente precisa de: quando usar (e quando não usar), variantes com exemplo visual, props/propriedades disponíveis e exemplo de código copiável. Nada mais. O Storybook resolve bem esse problema quando bem configurado.</p><h2>Governança: o problema real</h2><p>O maior desafio não é técnico — é de processo. Quem pode contribuir com novos componentes? Como é o processo de revisão? Como versionar breaking changes? Sem governança clara, o design system vira bagunça em 6 meses. Defina isso antes de lançar.</p>`,
      tags: ['Design System', 'UX Design', 'UI Design', 'Figma'],
      year: 2024,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1558655146-9f40138edfeb',
    },
    {
      title: 'Pesquisa com Usuários na Prática: Método que Funciona em Startups',
      subtitle: 'Como fazer research de qualidade sem budget de enterprise',
      contentHtml: `<p>Research de usuário não precisa de budget milionário, laboratório sofisticado ou meses de planejamento. Em startups, descobri que 5 entrevistas bem conduzidas revelam 85% dos problemas de usabilidade. O segredo está no método, não na escala.</p><h2>Recrutamento rápido e eficaz</h2><p>Você não precisa de agência de recrutamento. Para B2C: use sua própria base de usuários com incentivo pequeno (desconto, crédito). Para B2B: LinkedIn direto funciona surpreendentemente bem com uma mensagem honesta e curta. Para produtos novos: peça para amigos de amigos que se encaixem no perfil.</p><h2>O roteiro de entrevista que uso</h2><p>Começo com 5 minutos de aquecimento (contexto do participante, dia a dia). Depois exploro o problema que o produto tenta resolver — sem mencionar o produto ainda. Só então introduzo protótipos ou o produto atual. Termino com "o que você faria diferente?" Nunca faço perguntas fechadas do tipo "você usaria isso?"</p><h2>Análise rápida e acionável</h2><p>Após cada entrevista, passo 15 minutos escrevendo 3 insights principais — enquanto fresco. Ao final de todas as entrevistas, agrupo insights em temas e conto frequência. O que apareceu em 3 ou mais entrevistas merece atenção imediata. O que apareceu uma vez vai para o backlog.</p><h2>Apresentando resultados</h2><p>Stakeholders não leem relatório de 30 páginas. Uma página com: objetivo do research, metodologia em 3 linhas, top 5 insights com evidência direta (citação do participante) e recomendações priorizadas. Isso move a agulha.</p>`,
      tags: ['UX Research', 'UX Design', 'Pesquisa com Usuários'],
      year: 2024,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1581291518857-4e27b48ff24e',
    },
  ],
  'Designer Gráfico': [
    {
      title: 'Identidade Visual para Startup de Tecnologia',
      subtitle: 'Do briefing à entrega — processo completo de branding',
      contentHtml: `<p>Desenvolver identidade visual para startup de tecnologia é um dos projetos mais desafiadores — e mais recompensadores — que um designer gráfico pode ter. O mercado tech tem suas convenções (azul, fontes sem serifa, clean) e ao mesmo tempo valoriza diferenciação. Neste case, mostro como trabalhei com uma fintech para criar uma marca memorável.</p><h2>Briefing e imersão</h2><p>O briefing inicial revelou um gap: a fintech queria parecer "confiável e segura" (código para: igual a todos os concorrentes) mas também "acessível e humana" para o público jovem desbancarizado que queria atingir. Passei uma semana entendendo o produto, conversando com usuários e mapeando o cenário competitivo.</p><h2>Posicionamento visual</h2><p>A análise competitiva mostrou que todos os concorrentes usavam azul, verde ou roxo. Cores "seguras". Decidi propor laranja — associado a energia, acessibilidade e ação. O risco era alto, mas diferenciação real exige coragem. O cliente topou após ver como o laranja funcionava nos materiais.</p><h2>Construção do logotipo</h2><p>Três semanas e 40 estudos de tipografia depois, chegamos a uma wordmark custom baseada em fonte geométrica com intervenções manuais que criam caráter único. A fonte customizada não existe em nenhum outro lugar — impossível confundir com outra marca.</p><h2>Sistema de identidade</h2><p>O logo é apenas o começo. O sistema inclui: paleta primária e secundária, gradientes de uso codificado, grid de composição, biblioteca de ícones de traço fino e templates para os 12 formatos mais usados (social, apresentação, email, etc.). A entrega final foi um manual de 45 páginas + arquivos em todos os formatos.</p>`,
      tags: ['Branding', 'Identidade Visual', 'Design Gráfico', 'Logo'],
      year: 2024,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1626785774573-4b799315345d',
    },
    {
      title: 'Tipografia: O Elemento que Designers Iniciantes Ignoram',
      subtitle: 'Como o uso correto de fontes transforma um design',
      contentHtml: `<p>Tipografia é o elemento que separa design amador de design profissional. Você pode ter as melhores fotos, cores perfeitas e layout equilibrado — mas tipografia mal aplicada destrói tudo. Depois de 9 anos como designer gráfico, este é o conhecimento que mais impactou meu trabalho.</p><h2>Hierarquia tipográfica</h2><p>O olho humano precisa de guia. A hierarquia tipográfica cria essa guia através de contraste de tamanho, peso, cor e estilo. Uma boa regra de partida: no máximo 3 níveis de tamanho na mesma peça. Títulos, subtítulos/destaques e corpo de texto. Qualquer complexidade além disso precisa de justificativa.</p><h2>Combinação de fontes</h2><p>A regra mais segura: sem serifa para títulos, com serifa para corpo de texto longo (ou vice-versa, mas nunca duas fontes do mesmo estilo sem contraste claro). O método científico: sites como FontJoy geram pares harmoniosos. O método artístico: aprender a reconhecer fontes com personalidades complementares.</p><h2>Espaçamento: kerning, tracking e leading</h2><p>Kerning é o espaço entre pares específicos de caracteres (WA, VA, Te). Tracking é o espaço uniforme entre todas as letras de uma palavra. Leading é o espaçamento entre linhas. Textos em caixa alta sempre precisam de tracking aumentado (+50 a +100). Corpo de texto confortável tem leading de 1.4 a 1.6x o tamanho da fonte.</p><h2>Legibilidade vs. Leiturabilidade</h2><p>Legibilidade é conseguir reconhecer caracteres individuais. Leiturabilidade é conseguir ler longos trechos sem esforço. Uma fonte pode ser legível (reconhecemos cada letra) mas ter péssima leiturabilidade (cansativa para textos longos). Scripts e fontes decorativas têm baixa leiturabilidade — use apenas para títulos curtos.</p>`,
      tags: ['Tipografia', 'Design Gráfico', 'Branding'],
      year: 2024,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1609921212029-bb5a28e60960',
    },
  ],
  'Contador e Consultor Tributário': [
    {
      title: 'Planejamento Tributário Legal: Reduza Impostos sem Risco',
      subtitle: 'Estratégias aprovadas pela Receita Federal para empresas',
      contentHtml: `<p>Planejamento tributário é o conjunto de ações legais que reduz a carga fiscal da empresa dentro dos limites da lei. É diferente de sonegação — que é crime. Em 14 anos atendendo empresas de todos os tamanhos, identifico potencial de redução média de 20-35% na carga tributária de empresas que nunca fizeram planejamento adequado.</p><h2>Escolha do regime tributário</h2><p>A primeira e maior decisão tributária é o regime: Simples Nacional, Lucro Presumido ou Lucro Real. Não existe regime universalmente melhor — depende de faturamento, margem de lucro, folha de pagamento, natureza da atividade e perspectiva de crescimento. Empresas com margem alta (tecnologia, consultoria) frequentemente pagam menos no Lucro Presumido do que no Simples acima de determinado faturamento.</p><h2>Pro-labore x Dividendos</h2><p>Sócios de empresas têm dois tipos de remuneração: pro-labore (salário do sócio, tributado pelo IRPF e com INSS) e dividendos (distribuição de lucro, atualmente isenta de IR para o beneficiário). A otimização entre esses dois é uma das ferramentas mais simples e mais impactantes para sócios de pequenas empresas.</p><h2>Benefícios fiscais setoriais</h2><p>Cada setor tem benefícios específicos. Empresas de tecnologia podem se beneficiar do Programa Computar com redução de alíquotas de PIS/COFINS. Atividades de P&D têm incentivos especiais. Empresas exportadoras têm imunidades constitucionais. Identificar e usar benefícios aplicáveis ao seu setor é obrigação do bom contador.</p><h2>Jurisprudência favorável</h2><p>Acompanhar decisões do CARF e do STJ/STF pode gerar oportunidades de recuperação de tributos pagos a maior. Teses como a "tese do século" (exclusão do ICMS da base do PIS/COFINS) geraram bilhões em recuperações para empresas que foram assessoradas adequadamente.</p>`,
      tags: ['Contabilidade', 'Planejamento Tributário', 'Impostos'],
      year: 2024,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1554224155-6726b3ff858f',
    },
    {
      title: 'MEI 2025: Tudo que Mudou e Como Regularizar',
      subtitle: 'Guia atualizado para Microempreendedores Individuais',
      contentHtml: `<p>O Microempreendedor Individual (MEI) é o regime mais simples do Brasil — mas tem particularidades que precisam de atenção. Em 2025, mudanças no limite de faturamento e nas regras de enquadramento afetam milhões de empreendedores. Este guia é o que você precisa saber.</p><h2>Limite de faturamento</h2><p>Em 2025, o MEI pode faturar até R$ 81.000 por ano (R$ 6.750/mês). Para MEI caminhoneiro ou de serviços de transporte de passageiros, o limite é de R$ 251.600. Ultrapassar esses limites exige reenquadramento obrigatório como ME no ano seguinte — e a diferença de carga tributária pode ser significativa.</p><h2>DAS: o que está incluído</h2><p>A Declaração e Apuração do Simples (DAS) do MEI inclui: INSS (5% do salário mínimo), ICMS fixo (para comércio e indústria — R$ 1,00) ou ISS fixo (para serviços — R$ 5,00). Em 2025, o valor total do DAS para serviços é de aproximadamente R$ 75,90/mês.</p><h2>DASN-SIMEI: a declaração anual</h2><p>Todo MEI deve apresentar a Declaração Anual do Simples Nacional (DASN-SIMEI) até 31 de maio de cada ano, referente ao exercício anterior. A omissão gera multa mínima de R$ 50,00. A declaração é simples — informa apenas o faturamento bruto do ano e se houve ou não empregado.</p><h2>Contratação de funcionário</h2><p>O MEI pode ter apenas UM empregado, com salário mínimo ou piso da categoria. A folha do MEI tem simplificações importantes: o eSocial tem módulo simplificado. O FGTS do funcionário (8%) e a contribuição patronal previdenciária (3%) são os encargos principais — mais simples do que parece.</p>`,
      tags: ['MEI', 'Contabilidade', 'Empreendedorismo'],
      year: 2025,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1450101499163-c8848c66ca85',
    },
  ],
  'Contadora e Gestora Financeira': [
    {
      title: 'Fluxo de Caixa: A Ferramenta que Salva Empresas',
      subtitle: 'Como construir e interpretar seu fluxo de caixa',
      contentHtml: `<p>Lucro e caixa são coisas diferentes — e confundir os dois mata empresas lucrativas. Empreendedores focados apenas no resultado do mês ignoram o timing dos recebimentos e pagamentos, e chegam a um momento em que têm lucro contábil mas não têm dinheiro para pagar fornecedores. O fluxo de caixa evita este pesadelo.</p><h2>O que é fluxo de caixa?</h2><p>Fluxo de caixa é o registro e projeção de entradas e saídas de dinheiro da empresa ao longo do tempo. Não é demonstrativo de resultado — não usa competência. É puramente o que entra e sai da conta bancária, quando entra e sai.</p><h2>Fluxo de caixa direto vs. indireto</h2><p>O método direto lista cada recebimento e pagamento por categoria: recebimentos de clientes, pagamentos a fornecedores, salários, impostos, etc. É mais simples de construir e mais intuitivo de ler. O método indireto parte do lucro líquido e ajusta pelas variações de ativos e passivos — útil para análise financeira mais sofisticada.</p><h2>Projeção de caixa: os 90 dias seguintes</h2><p>A projeção de caixa para os próximos 90 dias é a ferramenta de gestão mais valiosa para pequenas empresas. Permite identificar com antecedência períodos de déficit (e agir antes: negociar prazo com fornecedor, antecipar recebíveis) e períodos de superávit (aplicar o excesso, amortizar dívida).</p><h2>Indicadores de alerta</h2><p>Atenção a: ciclo financeiro crescendo (demora mais para receber, mas não para pagar), capital de giro negativo persistente, dependência excessiva de crédito para custeio operacional. Esses sinais identificados cedo permitem correção de rota antes da crise.</p>`,
      tags: ['Gestão Financeira', 'Contabilidade', 'Fluxo de Caixa'],
      year: 2024,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1611974789855-9c2a0a7236a3',
    },
    {
      title: 'Imposto de Renda Pessoa Física 2025: Não Deixe Dinheiro na Mesa',
      subtitle: 'Deduções legais e estratégias para maximizar sua restituição',
      contentHtml: `<p>A declaração de IRPF é obrigatória para quem recebeu rendimentos tributáveis acima de R$ 33.888 em 2024 (entre outros critérios). Mas além de cumprir a obrigação, a declaração é oportunidade de recuperar impostos pagos a maior — quando feita corretamente.</p><h2>Deduções que muita gente esquece</h2><p>Contribuições ao PGBL são dedutíveis até 12% da renda bruta tributável — e muitos contribuintes não usam esse benefício. Despesas médicas não têm limite de dedução, mas precisam ter comprovação documental (recibos, notas fiscais). Dependentes deduzem R$ 2.275,08 cada por ano.</p><h2>Declaração simplificada vs. completa</h2><p>A declaração simplificada oferece desconto padrão de 20% da renda tributável (limitado a R$ 16.754,34). A completa usa as deduções reais. A regra: se suas deduções reais (saúde, educação, previdência, dependentes) somarem mais que R$ 16.754,34, a declaração completa é melhor. O próprio Leão (programa da Receita) calcula e sugere a melhor opção.</p><h2>Bens e direitos: atenção ao ganho de capital</h2><p>Venda de imóvel, ações ou outros bens pode gerar ganho de capital tributável (15% a 22,5% dependendo do valor). Há isenções importantes: imóvel único vendido por até R$ 440.000, reinvestimento em outro imóvel em até 180 dias. Não declarar ganho de capital é uma das maiores fontes de autuação da Receita.</p><h2>Prazo e multas</h2><p>O prazo de entrega é até 31 de maio. Entrega com atraso: multa mínima de R$ 165,74 ou 1% ao mês sobre o imposto devido. Quem tem restituição perde posição na fila a cada dia de atraso — declarações entregues primeiro são processadas primeiro.</p>`,
      tags: ['Imposto de Renda', 'IRPF', 'Contabilidade', 'Finanças Pessoais'],
      year: 2025,
      projectStatus: 'COMPLETED',
      coverUnsplashId: 'photo-1607863680198-23d4b2565df0',
    },
  ],
};

// ---------------------------------------------------------------------------

@Injectable()
export class FakeSeedService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
  ) {}

  private async uploadImageFromUrl(
    url: string,
    key: string,
    context: 'avatar' | 'cover',
  ): Promise<{ url: string; key: string } | null> {
    try {
      const buffer = await downloadBuffer(url);
      const processed = await this.storageService.processImage(buffer, context);
      const publicUrl = await this.storageService.uploadFile(processed, key, 'image/webp');
      return { url: publicUrl, key };
    } catch (e: any) {
      console.warn(`  ⚠ Could not upload image from ${url}: ${e.message}`);
      return null;
    }
  }

  async run(): Promise<{
    message: string;
    skipped?: boolean;
    users?: number;
    portfolioItems?: number;
  }> {
    // Idempotency guard
    const existing = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM users WHERE email LIKE $1 LIMIT 1`,
      [`%${FAKE_EMAIL_SUFFIX}`],
    );
    if (existing.length > 0) {
      return { message: 'Fake seed already executed — run clear first', skipped: true };
    }

    const passwordHash = await bcrypt.hash('FakeSeed@2025', 10);
    let totalItems = 0;
    let totalUsers = 0;

    for (const seedUser of FAKE_USERS) {
      console.log(`\n→ Creating user: ${seedUser.firstName} ${seedUser.lastName} (${seedUser.profession})`);

      const usernameBase = `${seedUser.firstName.toLowerCase()}-${seedUser.lastName.toLowerCase()}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      const username = usernameBase.replace(/^dr[a]?\.-?/, '').replace(/^dra?\.-?/, '');
      const email = `${username}${FAKE_EMAIL_SUFFIX}`;

      // Download and upload avatar
      const avatarUrl = `https://images.unsplash.com/${seedUser.avatarUnsplashId}?w=400&h=400&fit=crop&crop=faces`;
      const avatarKey = `avatars/fakeseed-${username}.webp`;
      console.log(`  ↳ Uploading avatar...`);
      const avatar = await this.uploadImageFromUrl(avatarUrl, avatarKey, 'avatar');

      await this.dataSource.transaction(async (manager) => {
        // Create user
        const userResult = await manager.query<Array<{ id: string }>>(
          `INSERT INTO users
             ("firstName", "lastName", email, password, username, profession,
              bio, location, "bannerColor", "avatarUrl", "avatarKey",
              "authProvider", "isActive", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'local',true,NOW(),NOW())
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
            avatar?.url ?? null,
            avatar?.key ?? null,
          ],
        );
        const userId = userResult[0].id;
        totalUsers++;

        // Create portfolio items
        const projects = PROJECTS_BY_PROFESSION[seedUser.profession] ?? [];
        for (const project of projects) {
          console.log(`  ↳ Creating project: "${project.title}"`);

          const slugBase = makeSlug(project.title, userId);
          const coverKey = `covers/fakeseed-${slugBase}.webp`;
          const coverUrl = `https://images.unsplash.com/${project.coverUnsplashId}?w=1280&h=720&fit=crop`;

          console.log(`    ↳ Uploading cover image...`);
          const cover = await this.uploadImageFromUrl(coverUrl, coverKey, 'cover');

          const contentDoc = htmlToTipTap(project.contentHtml);

          await manager.query(
            `INSERT INTO portfolio_items
               ("userId", title, subtitle, slug, content, "coverImageUrl", "coverImageKey",
                year, "projectStatus", status, "createdAt", "updatedAt")
             VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,'PUBLISHED',NOW(),NOW())`,
            [
              userId,
              project.title,
              project.subtitle,
              slugBase,
              JSON.stringify(contentDoc),
              cover?.url ?? null,
              cover?.key ?? null,
              project.year,
              project.projectStatus,
            ],
          );
          totalItems++;
        }
      });
    }

    return {
      message: 'Fake seed executed successfully',
      users: totalUsers,
      portfolioItems: totalItems,
    };
  }

  async clear(): Promise<{ message: string; deleted: number }> {
    const seedUsers = await this.dataSource.query<Array<{ id: string; avatarKey: string | null }>>(
      `SELECT id, "avatarKey" FROM users WHERE email LIKE $1`,
      [`%${FAKE_EMAIL_SUFFIX}`],
    );

    if (seedUsers.length === 0) {
      return { message: 'No fake seed data found', deleted: 0 };
    }

    const userIds = seedUsers.map((u) => u.id);

    // Collect cover image keys to delete from R2
    const coverItems = await this.dataSource.query<Array<{ coverImageKey: string | null }>>(
      `SELECT "coverImageKey" FROM portfolio_items WHERE "userId" = ANY($1)`,
      [userIds],
    );

    await this.dataSource.transaction(async (manager) => {
      const items = await manager.query<Array<{ id: string }>>(
        `SELECT id FROM portfolio_items WHERE "userId" = ANY($1)`,
        [userIds],
      );
      const itemIds = items.map((i: { id: string }) => i.id);

      if (itemIds.length > 0) {
        await manager.query(
          `DELETE FROM portfolio_tags WHERE "portfolioItemsId" = ANY($1)`,
          [itemIds],
        );
        await manager.query(`DELETE FROM portfolio_items WHERE id = ANY($1)`, [itemIds]);
      }

      await manager.query(`DELETE FROM tags WHERE "userId" = ANY($1)`, [userIds]);
      await manager.query(`DELETE FROM users WHERE id = ANY($1)`, [userIds]);
    });

    // Delete images from R2 (best effort)
    const keysToDelete = [
      ...seedUsers.map((u) => u.avatarKey).filter(Boolean),
      ...coverItems.map((i) => i.coverImageKey).filter(Boolean),
    ] as string[];

    for (const key of keysToDelete) {
      try {
        await this.storageService.deleteFile(key);
      } catch {
        // best effort
      }
    }

    return { message: 'Fake seed data cleared', deleted: seedUsers.length };
  }
}

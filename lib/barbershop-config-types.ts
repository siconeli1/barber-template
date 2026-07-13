export type Periodo = {
  inicio: string;
  fim: string;
};

export type CoresTema = {
  background: string;
  foreground: string;
  surface: string;
  surfaceStrong: string;
  muted: string;
  /** Cor primaria da marca (botoes, destaques). */
  accent: string;
  /** Variacao clara da primaria (hover, textos de destaque). */
  accentStrong: string;
  /** Variacao escura da primaria. */
  accentDeep: string;
  success: string;
  danger: string;
};

export type Tema = {
  cores: CoresTema;
  /** Pilha de fontes aplicada ao site inteiro. */
  fontSans: string;
  fontMono: string;
};

export type CategoriaServico = "corte" | "barba" | "sobrancelha" | "combo" | "outro";

export type CoberturaPlano = {
  corte: number;
  barba: number;
  sobrancelha: number;
};

export type ServicoConfig = {
  id: string;
  nome: string;
  categoria: CategoriaServico;
  duracaoMinutos: number;
  preco: number;
  /**
   * Quantas unidades de cada categoria o servico consome de um plano mensal.
   * Se omitido, e derivado da categoria (corte consome 1 corte, etc.).
   */
  coberturaPlano?: CoberturaPlano;
};

export type PlanoConfig = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  cortes: number;
  barbas: number;
  sobrancelhas: number;
};

export type RedesSociais = {
  instagram?: string;
  facebook?: string;
};

export type BarbershopConfig = {
  /** Nome curto da barbearia, usado em titulos, headers e mensagens. */
  nome: string;
  /** Nome completo exibido no hero da home. */
  nomeExibicao: string;
  /** Descricao usada em metadados (SEO / compartilhamento). */
  descricao: string;
  /**
   * Prefixo tecnico (sem espacos/acentos) para chaves de localStorage e eventos.
   * Trocar de cliente evita misturar sessoes no navegador.
   */
  slug: string;
  /** URL publica do site (fallback quando NEXT_PUBLIC_SITE_URL nao esta definida). */
  siteUrl: string;

  /** Caminho da logo dentro de /public (ex.: /logos/minha-barbearia.jpg). */
  logo: string;
  /** Imagem usada em compartilhamentos (Open Graph / Twitter). */
  ogImage: string;

  tema: Tema;

  /** Telefone WhatsApp da loja, ex.: "+55 11 99999-0000". */
  whatsapp: string;
  endereco: string;
  redesSociais: RedesSociais;

  /** Timezone IANA usada pelo motor de agenda, ex.: "America/Sao_Paulo". */
  timezone: string;
  /**
   * Horarios de funcionamento por dia da semana (0=domingo ... 6=sabado).
   * Dias ausentes sao considerados fechados.
   */
  horarios: Record<number, Periodo[]>;

  /** Catalogo de servicos (fallback quando o banco nao responde ou esta vazio). */
  servicos: ServicoConfig[];
  /** Planos mensais (fallback quando o banco nao responde ou esta vazio). */
  planos: PlanoConfig[];
};

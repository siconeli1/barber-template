import type { BarbershopConfig } from "@/lib/barbershop-config-types";

// Contatos, endereco e catalogo sao placeholders — troque pelos valores reais do cliente.
const magnata: BarbershopConfig = {
  nome: "Magnata Barbearia",
  nomeExibicao: "Magnata Barbearia",
  descricao: "Agendamento online e area administrativa da Magnata Barbearia",
  slug: "magnata",
  siteUrl: "https://magnata-barbearia.vercel.app",

  logo: "/logos/logo-magnata.jpg",
  ogImage: "/logos/logo-magnata.jpg",

  // Paleta derivada da logo: fundo preto, letras brancas e detalhes laranja.
  tema: {
    cores: {
      background: "#050505",
      foreground: "#f5f2ec",
      surface: "#111111",
      surfaceStrong: "#171717",
      muted: "#a5a09a",
      accent: "#e87e2e",
      accentStrong: "#f39a55",
      accentDeep: "#a75417",
      success: "#3ecf8e",
      danger: "#ff6b6b",
    },
    fontSans: '"Segoe UI", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
    fontMono: '"Cascadia Code", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
  },

  whatsapp: "+55 11 90000-0000",
  endereco: "Rua Exemplo, 123, Centro, São Paulo",
  redesSociais: {
    instagram: "https://instagram.com/magnatabarbearia",
  },

  timezone: "America/Sao_Paulo",
  horarios: {
    1: [{ inicio: "09:00", fim: "19:00" }],
    2: [{ inicio: "09:00", fim: "19:00" }],
    3: [{ inicio: "09:00", fim: "19:00" }],
    4: [{ inicio: "09:00", fim: "19:00" }],
    5: [{ inicio: "09:00", fim: "20:00" }],
    6: [{ inicio: "08:00", fim: "16:00" }],
  },

  barbeiros: [
    {
      id: "barbeiro",
      nome: "Barbeiro",
      login: "admin",
      cargo: "socio",
    },
  ],

  servicos: [
    {
      id: "corte-de-cabelo",
      nome: "Corte de cabelo",
      categoria: "corte",
      duracaoMinutos: 30,
      preco: 45,
      coberturaPlano: { corte: 1, barba: 0, sobrancelha: 0 },
    },
    {
      id: "barba",
      nome: "Barba",
      categoria: "barba",
      duracaoMinutos: 30,
      preco: 35,
      coberturaPlano: { corte: 0, barba: 1, sobrancelha: 0 },
    },
    {
      id: "cabelo-barba",
      nome: "Cabelo + barba",
      categoria: "combo",
      duracaoMinutos: 60,
      preco: 75,
      coberturaPlano: { corte: 1, barba: 1, sobrancelha: 0 },
    },
  ],

  planos: [
    {
      id: "premium",
      nome: "Plano Premium",
      descricao: "4 cortes e 4 barbas no ciclo mensal",
      preco: 180,
      cortes: 4,
      barbas: 4,
      sobrancelhas: 0,
    },
    {
      id: "essencial",
      nome: "Plano Essencial",
      descricao: "4 cortes no ciclo mensal",
      preco: 120,
      cortes: 4,
      barbas: 0,
      sobrancelhas: 0,
    },
  ],
};

export default magnata;

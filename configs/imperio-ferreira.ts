import type { BarbershopConfig } from "@/lib/barbershop-config-types";

const imperioFerreira: BarbershopConfig = {
  nome: "Império Ferreira",
  nomeExibicao: "Barbearia Império Ferreira",
  descricao: "Agendamento online e area administrativa da Imperio Ferreira",
  slug: "imperio",
  siteUrl: "https://imperio-ferreira.vercel.app",

  logo: "/logos/imperio-ferreira.jpg",
  ogImage: "/logos/imperio-ferreira.jpg",

  tema: {
    cores: {
      background: "#050505",
      foreground: "#f4efe5",
      surface: "#111111",
      surfaceStrong: "#171717",
      muted: "#9ea89f",
      accent: "#d2a95f",
      accentStrong: "#e3bb73",
      accentDeep: "#8c6b2e",
      success: "#3ecf8e",
      danger: "#ff6b6b",
    },
    fontSans: '"Segoe UI", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
    fontMono: '"Cascadia Code", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
  },

  whatsapp: "+55 17 98131-4724",
  endereco: "Av. dos Arnaldos, 3407, Antônia Franco, Fernandópolis",
  redesSociais: {},

  timezone: "America/Sao_Paulo",
  horarios: {
    1: [{ inicio: "09:00", fim: "19:00" }],
    2: [{ inicio: "09:00", fim: "19:00" }],
    3: [{ inicio: "09:00", fim: "19:00" }],
    4: [{ inicio: "09:00", fim: "20:00" }],
    5: [{ inicio: "08:00", fim: "20:00" }],
    6: [{ inicio: "09:00", fim: "15:00" }],
  },

  servicos: [
    {
      id: "barba",
      nome: "Barba",
      categoria: "barba",
      duracaoMinutos: 30,
      preco: 30,
      coberturaPlano: { corte: 0, barba: 1, sobrancelha: 0 },
    },
    {
      id: "acabamento",
      nome: "Acabamento",
      categoria: "outro",
      duracaoMinutos: 10,
      preco: 15,
    },
    {
      id: "cabelo-barba",
      nome: "Cabelo + barba",
      categoria: "combo",
      duracaoMinutos: 60,
      preco: 70,
      coberturaPlano: { corte: 1, barba: 1, sobrancelha: 0 },
    },
    {
      id: "combo-cabelo-barba-sobrancelha",
      nome: "Combo cabelo + barba + sobrancelha",
      categoria: "combo",
      duracaoMinutos: 60,
      preco: 75,
      coberturaPlano: { corte: 1, barba: 1, sobrancelha: 1 },
    },
    {
      id: "corte-de-cabelo",
      nome: "Corte de cabelo",
      categoria: "corte",
      duracaoMinutos: 30,
      preco: 40,
      coberturaPlano: { corte: 1, barba: 0, sobrancelha: 0 },
    },
    {
      id: "corte-cabelo-sobrancelha",
      nome: "Corte de cabelo + sobrancelha",
      categoria: "combo",
      duracaoMinutos: 30,
      preco: 50,
      coberturaPlano: { corte: 1, barba: 0, sobrancelha: 1 },
    },
    {
      id: "depilacao-nariz",
      nome: "Depilacao de nariz",
      categoria: "outro",
      duracaoMinutos: 10,
      preco: 20,
    },
  ],

  planos: [
    {
      id: "bronze-corte",
      nome: "Plano Bronze Corte",
      descricao: "4 cortes no ciclo mensal",
      preco: 100,
      cortes: 4,
      barbas: 0,
      sobrancelhas: 0,
    },
    {
      id: "bronze-barba",
      nome: "Plano Bronze Barba",
      descricao: "4 barbas no ciclo mensal",
      preco: 60,
      cortes: 0,
      barbas: 4,
      sobrancelhas: 0,
    },
    {
      id: "prata",
      nome: "Plano Prata",
      descricao: "4 cortes e 4 sobrancelhas no ciclo mensal",
      preco: 110,
      cortes: 4,
      barbas: 0,
      sobrancelhas: 4,
    },
    {
      id: "ouro",
      nome: "Plano Ouro",
      descricao: "4 barbas, 4 cortes e 4 sobrancelhas no ciclo mensal",
      preco: 150,
      cortes: 4,
      barbas: 4,
      sobrancelhas: 4,
    },
  ],
};

export default imperioFerreira;

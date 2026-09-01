import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

/**
 * Testes de RLS contra o Supabase local (`npx supabase start`).
 *
 * Não são testes de unidade: eles provam que o BANCO nega o acesso, não que o
 * componente lembrou de filtrar. Toda policy aqui é verificada com dois lados —
 * o dono e o intruso — porque o caso do intruso é o único que importa.
 *
 * Rodar com: npm run test:rls
 */

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const SENHA = 'senha-de-teste-123';

const admin = createClient<Database>(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Ator = { id: string; email: string; cliente: SupabaseClient<Database> };

async function criaAtor(email: string): Promise<Ator> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
  });
  if (error) throw error;

  const cliente = createClient<Database>(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const login = await cliente.auth.signInWithPassword({ email, password: SENHA });
  if (login.error) throw login.error;

  return { id: data.user.id, email, cliente };
}

const sufixo = Date.now();
const e = (nome: string) => `${nome}.${sufixo}@teste.local`;

let obraA: string;
let obraB: string;
let responsavel: Ator;
let intruso: Ator;
let gestor: Ator;
let pmo: Ator;
let restricaoDoResponsavel: string;
let restricaoDoIntruso: string;
let restricaoObraB: string;

beforeAll(async () => {
  responsavel = await criaAtor(e('responsavel'));
  intruso = await criaAtor(e('intruso'));
  gestor = await criaAtor(e('gestor'));
  pmo = await criaAtor(e('pmo'));

  const obras = await admin
    .from('obras')
    .insert([
      { codigo: `IMCS-CT09-PLAN-${sufixo}`, nome: 'IMCS piloto' },
      { codigo: `MROS-CT02-CAIN-${sufixo}`, nome: 'MROS outra obra' },
    ])
    .select('id, codigo');
  if (obras.error) throw obras.error;
  obraA = obras.data[0].id;
  obraB = obras.data[1].id;

  const membros = await admin.from('membros_obra').insert([
    { obra_id: obraA, user_id: responsavel.id, papel: 'responsavel' },
    { obra_id: obraA, user_id: intruso.id, papel: 'responsavel' },
    { obra_id: obraA, user_id: gestor.id, papel: 'gestor' },
    { obra_id: obraB, user_id: intruso.id, papel: 'responsavel' },
  ]);
  if (membros.error) throw membros.error;

  const promove = await admin.from('perfis').update({ pmo: true }).eq('id', pmo.id);
  if (promove.error) throw promove.error;

  const restricoes = await admin
    .from('restricoes')
    .insert([
      {
        obra_id: obraA,
        descricao: 'Liberar fundacao do eixo 4',
        responsavel_email: responsavel.email,
        data_limite: '2026-12-31',
      },
      {
        obra_id: obraA,
        descricao: 'Restricao de outra pessoa na mesma obra',
        responsavel_email: intruso.email,
      },
      {
        obra_id: obraB,
        descricao: 'Restricao de outra obra',
        responsavel_email: responsavel.email,
      },
    ])
    .select('id');
  if (restricoes.error) throw restricoes.error;
  restricaoDoResponsavel = restricoes.data[0].id;
  restricaoDoIntruso = restricoes.data[1].id;
  restricaoObraB = restricoes.data[2].id;
}, 60_000);

afterAll(async () => {
  await admin.from('obras').delete().in('id', [obraA, obraB]);
  for (const ator of [responsavel, intruso, gestor, pmo]) {
    if (ator?.id) await admin.auth.admin.deleteUser(ator.id);
  }
});

describe('perfil', () => {
  it('e criado automaticamente no primeiro login', async () => {
    const { data } = await responsavel.cliente
      .from('perfis')
      .select('email, pmo')
      .eq('id', responsavel.id)
      .single();

    expect(data?.email).toBe(responsavel.email);
    expect(data?.pmo).toBe(false);
  });

  it('nao permite que o usuario se promova a PMO', async () => {
    const { error } = await responsavel.cliente
      .from('perfis')
      .update({ pmo: true })
      .eq('id', responsavel.id);

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/PMO/i);
  });
});

describe('visibilidade de restricoes', () => {
  it('responsavel ve as restricoes endereçadas a ele', async () => {
    const { data } = await responsavel.cliente.from('restricoes').select('id');
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toContain(restricaoDoResponsavel);
  });

  it('responsavel NAO ve a restricao de outra pessoa, mesmo na obra dele', async () => {
    const { data } = await responsavel.cliente
      .from('restricoes')
      .select('id')
      .eq('id', restricaoDoIntruso);

    expect(data).toEqual([]);
  });

  it('responsavel NAO ve restricao de obra em que nao e membro', async () => {
    const { data } = await responsavel.cliente
      .from('restricoes')
      .select('id')
      .eq('id', restricaoObraB);

    expect(data).toEqual([]);
  });

  it('gestor ve todas as restricoes da obra dele', async () => {
    const { data } = await gestor.cliente.from('restricoes').select('id');
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toContain(restricaoDoResponsavel);
    expect(ids).toContain(restricaoDoIntruso);
  });

  it('gestor NAO ve restricao de outra obra', async () => {
    const { data } = await gestor.cliente
      .from('restricoes')
      .select('id')
      .eq('id', restricaoObraB);

    expect(data).toEqual([]);
  });

  it('PMO ve as restricoes de todas as obras', async () => {
    const { data } = await pmo.cliente
      .from('restricoes')
      .select('id')
      .in('id', [restricaoDoResponsavel, restricaoDoIntruso, restricaoObraB]);

    expect(data).toHaveLength(3);
  });

  it('usuario anonimo nao ve nada', async () => {
    const anon = createClient<Database>(URL, ANON);
    const { data } = await anon.from('restricoes').select('id');
    expect(data).toEqual([]);
  });
});

describe('mudanca de status', () => {
  it('responsavel muda o status da propria restricao', async () => {
    const { error } = await responsavel.cliente
      .from('restricoes')
      .update({ status: 'em_tratativa' })
      .eq('id', restricaoDoResponsavel);

    expect(error).toBeNull();

    const { data } = await admin
      .from('restricoes')
      .select('status, status_alterado_por')
      .eq('id', restricaoDoResponsavel)
      .single();

    expect(data?.status).toBe('em_tratativa');
    expect(data?.status_alterado_por).toBe(responsavel.id);
  });

  it('a mudanca de status vira evento no historico sem o app precisar gravar', async () => {
    const { data } = await admin
      .from('restricao_eventos')
      .select('tipo, status_anterior, status_novo, autor_email')
      .eq('restricao_id', restricaoDoResponsavel)
      .eq('tipo', 'status');

    expect(data?.length).toBeGreaterThanOrEqual(1);
    const ultimo = data?.at(-1);
    expect(ultimo?.status_novo).toBe('em_tratativa');
    expect(ultimo?.autor_email).toBe(responsavel.email);
  });

  it('intruso NAO muda o status de restricao que nao e dele', async () => {
    await intruso.cliente
      .from('restricoes')
      .update({ status: 'resolvida' })
      .eq('id', restricaoDoResponsavel);

    // A RLS transforma o UPDATE em zero linhas afetadas, sem erro.
    const { data } = await admin
      .from('restricoes')
      .select('status')
      .eq('id', restricaoDoResponsavel)
      .single();

    expect(data?.status).toBe('em_tratativa');
  });
});

describe('protecao do cadastro (propriedade dividida por campo)', () => {
  it('responsavel NAO consegue alterar a descricao — esse campo e da planilha', async () => {
    const { error } = await responsavel.cliente
      .from('restricoes')
      .update({ descricao: 'tentando reescrever o cadastro' })
      .eq('id', restricaoDoResponsavel);

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/planilha/i);
  });

  it('responsavel NAO consegue reatribuir a restricao para outra pessoa', async () => {
    const { error } = await responsavel.cliente
      .from('restricoes')
      .update({ responsavel_email: intruso.email })
      .eq('id', restricaoDoResponsavel);

    expect(error).not.toBeNull();
  });

  it('a sincronizacao (service_role) continua podendo escrever o cadastro', async () => {
    const { error } = await admin
      .from('restricoes')
      .update({ descricao: 'descricao atualizada pela planilha' })
      .eq('id', restricaoDoResponsavel);

    expect(error).toBeNull();
  });
});

describe('comentarios', () => {
  it('quem enxerga a restricao pode comentar', async () => {
    const { error } = await responsavel.cliente.from('restricao_eventos').insert({
      restricao_id: restricaoDoResponsavel,
      tipo: 'comentario',
      autor_id: responsavel.id,
      autor_email: responsavel.email,
      comentario: 'Protocolo aberto na fiscalizacao',
    });

    expect(error).toBeNull();
  });

  it('intruso NAO consegue comentar em restricao que nao enxerga', async () => {
    const { error } = await intruso.cliente.from('restricao_eventos').insert({
      restricao_id: restricaoDoResponsavel,
      tipo: 'comentario',
      autor_id: intruso.id,
      comentario: 'comentario indevido',
    });

    expect(error).not.toBeNull();
  });

  it('ninguem consegue forjar autoria de comentario', async () => {
    const { error } = await responsavel.cliente.from('restricao_eventos').insert({
      restricao_id: restricaoDoResponsavel,
      tipo: 'comentario',
      autor_id: gestor.id,
      comentario: 'assinado como se fosse o gestor',
    });

    expect(error).not.toBeNull();
  });

  it('historico e imutavel: nem o autor apaga o proprio comentario', async () => {
    const { data: antes } = await admin
      .from('restricao_eventos')
      .select('id')
      .eq('restricao_id', restricaoDoResponsavel);

    await responsavel.cliente
      .from('restricao_eventos')
      .delete()
      .eq('restricao_id', restricaoDoResponsavel);

    const { data: depois } = await admin
      .from('restricao_eventos')
      .select('id')
      .eq('restricao_id', restricaoDoResponsavel);

    expect(depois?.length).toBe(antes?.length);
  });
});

describe('configuracao da obra', () => {
  it('so PMO enxerga obra_fontes — ela guarda URL do SharePoint e lista de copias', async () => {
    await admin.from('obra_fontes').insert({
      obra_id: obraA,
      arquivo_url: 'https://phdengenhariabr.sharepoint.com/sites/IMCS-CT09-PLAN/teste.xlsx',
    });

    const doGestor = await gestor.cliente.from('obra_fontes').select('arquivo_url');
    expect(doGestor.data).toEqual([]);

    const doPmo = await pmo.cliente.from('obra_fontes').select('arquivo_url');
    expect(doPmo.data?.length).toBeGreaterThanOrEqual(1);
  });
});

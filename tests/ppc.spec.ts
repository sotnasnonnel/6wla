import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { geraXlsx } from "../src/lib/exportacao/xlsx";
import { CAMPOS_PPC, ROTULOS_PPC } from "../src/lib/ppc/dominio";
import { existsSync } from "node:fs";

const obraId = "10000000-0000-0000-0000-000000000001";
const outraObra = "10000000-0000-0000-0000-000000000003";
const rota = `/obras/${obraId}/tabela-importacao`;

test("telão alterna automaticamente, permite pausar e não exibe edição", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/obras/${outraObra}/telao`);
  await page.getByLabel("E-mail", { exact: true }).fill("outro@6wla.local");
  await page.getByLabel("Senha", { exact: true }).fill("senha123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/telao$/);
  await expect(
    page.getByRole("heading", { name: "Obra da outra empresa", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Sair do telão" })).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Atualizar atividade/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("article")).toHaveCount(2);
  const pagina = page.getByRole("status").filter({ hasText: /Página/ });
  await expect(pagina).toContainText("Página 1 de");
  await page.clock.install();
  await page
    .getByRole("combobox", { name: "Tempo de exibição" })
    .selectOption("10");
  await page.clock.fastForward(11000);
  await expect(pagina).toContainText("Página 2 de");
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await page.clock.fastForward(15000);
  await expect(pagina).toContainText("Página 2 de");
  await page.getByRole("button", { name: "Próxima página" }).click();
  await expect(pagina).toContainText("Página 3 de");
  await page.getByRole("button", { name: "Página anterior" }).click();
  await expect(pagina).toContainText("Página 2 de");
  await page.getByRole("button", { name: "Tela cheia", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sair da tela cheia" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/ppc-telao-1080.png" });
  await page.getByRole("button", { name: "Sair da tela cheia" }).click();
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(page.getByRole("article")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/ppc-telao-768.png" });
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.clock.fastForward(11000);
  await expect(pagina).toContainText("Página 2 de");
});

test("visão semanal separa a tabela e apresenta equipe e uma casa decimal", async ({
  page,
}) => {
  await page.goto(`/obras/${outraObra}/check-in-check-out`);
  await page.getByLabel("E-mail", { exact: true }).fill("outro@6wla.local");
  await page.getByLabel("Senha", { exact: true }).fill("senha123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Check-in / Check-out", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  const ultima = page.getByRole("button", {
    name: "Ver última semana importada",
  });
  if (await ultima.isVisible()) await ultima.click();
  const cards = page.getByRole("article");
  await expect(
    page.getByRole("region", { name: "Resumo geral da semana" }),
  ).not.toContainText("Sem unidade");
  await expect(
    page.getByRole("region", { name: "Resumo geral da semana" }),
  ).toContainText("A conferir");
  await expect(
    page.getByRole("region", { name: "Resumo geral da semana" }),
  ).toContainText("Quantidade prevista e realizada por unidade");
  await expect(page.getByRole("button", { name: /Mostrar mais/ })).toHaveCount(
    0,
  );
  test.skip(
    (await cards.count()) === 0,
    "Não há programação local nesta obra para a conferência visual.",
  );
  await expect(
    page.getByRole("combobox", { name: "Semana", exact: true }),
  ).not.toHaveValue("atual");
  const filtroEncarregado = page.getByRole("combobox", {
    name: "Encarregado",
    exact: true,
  });
  await filtroEncarregado.selectOption({ index: 2 });
  const escolhido = await filtroEncarregado.inputValue();
  const grupos = page.getByRole("region", { name: /^Encarregado / });
  await expect(grupos).toHaveCount(1);
  const grupo = page.getByRole("region", {
    name: `Encarregado ${escolhido}`,
    exact: true,
  });
  await expect(
    grupo.getByRole("heading", { name: escolhido, exact: true }),
  ).toHaveCount(1);
  expect(await grupo.getByRole("article").count()).toBeGreaterThan(1);
  await filtroEncarregado.selectOption("");
  await page.getByLabel("Buscar atividade ou pessoa").fill("A10700");
  const card = page.getByRole("article", {
    name: "Atividade A10700",
    exact: true,
  });
  await expect(card).toContainText("6,1");
  await expect(card).toContainText("3,7");
  await expect(card).toContainText("Líder imediato");
  await expect(grupos).toHaveCount(1);
  await expect(card).toContainText("Desvio");
  await expect(card).toContainText("Não informado");
  await card
    .getByRole("button", { name: "Atualizar atividade A10700" })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Responsável", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByLabel("Nome da atividade"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByLabel("Buscar atividade ou pessoa").fill("");
  const nomes = await grupos.getByRole("heading").allTextContents();
  expect(new Set(nomes).size).toBe(nomes.length);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/ppc-semana-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/ppc-semana-mobile.png" });
  await page
    .getByRole("navigation", { name: "Visões da programação" })
    .getByRole("link", { name: "Tabela de importação" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tabela de importação", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
});

test("confere os pares da PPC.xlsx real e alterna a coluna da quantidade", async ({
  page,
}) => {
  test.skip(
    !existsSync("PPC.xlsx"),
    "A planilha de referência local não está disponível.",
  );
  await page.goto(rota);
  await page.getByLabel("E-mail", { exact: true }).fill("gestor@6wla.local");
  await page.getByLabel("Senha", { exact: true }).fill("senha123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("tabela-importacao$"));
  await page
    .getByRole("button", { name: "Importar programação", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Arquivo Excel").setInputFiles("PPC.xlsx");
  await modal.getByLabel("Aba da planilha").selectOption("Programação");
  await modal.getByRole("button", { name: "Conferir colunas" }).click();
  await expect(
    modal.getByRole("heading", {
      name: "1222 atividade(s) em pares Previsto / Real na aba Programação",
      exact: true,
    }),
  ).toBeVisible();
  const quantidade = modal.getByRole("combobox", {
    name: "Coluna da quantidade (Previsto e Real)",
    exact: true,
  });
  await expect(quantidade).toHaveValue("PPC");
  const linha = modal
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "10 / 11", exact: true }) });
  await expect(linha.getByRole("cell").nth(4)).toHaveText("1");
  await expect(linha.getByRole("cell").nth(5)).toHaveText("0.5");
  await quantidade.selectOption("QTD.");
  await expect(quantidade).toHaveValue("QTD.");
  await expect(linha.getByRole("cell").nth(5)).toHaveText("0.5");
  await modal.screenshot({ path: "test-results/ppc-pares-reais.png" });
  // Só conferir: não importar a planilha real nos dados de teste.
});

async function cliente(email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (
    !url ||
    !chave ||
    !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
  )
    throw new Error(
      "Testes PPC exigem o Supabase local e suas variáveis de ambiente.",
    );
  const db = createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.auth.signInWithPassword({
    email,
    password: "senha123",
  });
  if (error)
    throw new Error("Não foi possível autenticar o usuário de teste local.");
  return db;
}

function planilha(id: string, aba: string, termino = "2026-09-20") {
  return Buffer.from(
    geraXlsx({
      aba,
      colunas: CAMPOS_PPC.map((c) => ({ cabecalho: ROTULOS_PPC[c] })),
      linhas: [
        [
          id,
          "Montagem de tubulação de teste",
          "S-38",
          120.5,
          null,
          "Planejada",
          "Teste automático",
          "Material",
          "Líder A",
          "Encarregado B",
          "Responsável C",
          "Mecânica",
          "2026-09-14",
          termino,
        ],
      ],
    }),
  );
}

test("importa Programação e PPC, preserva duplicatas e permite editar e filtrar", async ({
  page,
}) => {
  const db = await cliente("gestor@6wla.local");
  const id = `QA-PPC-${Date.now()}`;
  try {
    await page.goto(rota);
    await page.getByLabel("E-mail", { exact: true }).fill("gestor@6wla.local");
    await page.getByLabel("Senha", { exact: true }).fill("senha123");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(new RegExp("tabela-importacao$"));
    await expect(
      page.locator("nav").getByRole("heading", { name: "6WLA", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator("nav").getByRole("heading", { name: "PPC", exact: true }),
    ).toBeVisible();

    const importar = async (aba: string, termino?: string) => {
      await page
        .getByRole("button", { name: "Importar programação", exact: true })
        .click();
      const dialogo = page.getByRole("dialog");
      await dialogo.getByLabel("Arquivo Excel").setInputFiles({
        name: "programacao.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: planilha(id, aba, termino),
      });
      await dialogo.getByLabel("Aba da planilha").selectOption(aba);
      await dialogo.getByRole("button", { name: "Conferir colunas" }).click();
      await expect(
        dialogo.getByRole("heading", {
          name: `1 linha(s) na aba ${aba}`,
          exact: true,
        }),
      ).toBeVisible();
      await dialogo
        .getByRole("button", { name: "Confirmar importação" })
        .click();
      return dialogo;
    };
    const invalido = await importar("PPC", "2026-09-13");
    await expect(invalido.getByRole("alert")).toContainText(
      "Nada foi importado",
    );
    await invalido.getByRole("button", { name: "Fechar", exact: true }).click();
    await importar("Programação");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "1 atividade(s) importada(s)" }),
    ).toBeVisible();
    await importar("PPC");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 960 });
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "0 atividade(s) importada(s). 1 já existente(s)" }),
    ).toBeVisible();
    await page.getByLabel("Buscar atividade ou pessoa").fill(id);
    const linha = page
      .getByRole("row")
      .filter({ has: page.getByRole("cell", { name: id, exact: true }) });
    await expect(linha).toHaveCount(1);
    await page
      .getByRole("button", { name: `Editar atividade ${id}`, exact: true })
      .click();
    const edicao = page.getByRole("dialog");
    await edicao
      .getByLabel("Quantidade realizada", { exact: true })
      .fill("100,5");
    await edicao
      .getByLabel("Status Planejamento", { exact: true })
      .fill("Em andamento");
    await edicao.getByRole("button", { name: "Salvar atividade" }).click();
    await expect(edicao).not.toBeVisible();
    await expect(linha).toContainText("100,5");
    await page.reload();
    await page.getByLabel("Buscar atividade ou pessoa").fill(id);
    await expect(linha).toContainText("Em andamento");
    await page.goto(`/obras/${obraId}/check-in-check-out`);
    await page.getByLabel("Buscar atividade ou pessoa").fill(id);
    const conferencia = page.getByRole("checkbox", {
      name: `Conferir atividade ${id}`,
      exact: true,
    });
    await conferencia.click();
    await expect(conferencia).toBeChecked();
    await page.reload();
    await page.getByLabel("Buscar atividade ou pessoa").fill(id);
    await expect(conferencia).toBeChecked();
    const alteracao = await db
      .from("atividades_ppc")
      .update({ observacoes: "Alteração após conferência" })
      .eq("obra_id", obraId)
      .eq("id_atividade", id)
      .select("conferido")
      .single();
    expect(alteracao.error).toBeNull();
    expect(alteracao.data?.conferido).toBe(false);
    await page.goto(rota);
    await page.getByLabel("Buscar atividade ou pessoa").fill(id);
    await page
      .getByRole("combobox", { name: "Disciplina", exact: true })
      .selectOption("Mecânica");
    await expect(linha).toHaveCount(1);
    await page.screenshot({
      path: "test-results/ppc-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole("heading", { name: "Tabela de importação", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
    await expect(
      page.locator("nav").getByRole("heading", { name: "6WLA", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/ppc-mobile.png",
      fullPage: true,
    });
  } finally {
    const { error } = await db
      .from("atividades_ppc")
      .delete()
      .eq("obra_id", obraId)
      .eq("id_atividade", id);
    if (error)
      throw new Error("Falha ao limpar os registros PPC criados pelo teste.");
    await db.auth.signOut();
  }
});

test("RLS isola workspaces e impede gravação por membro", async () => {
  const gestor = await cliente("gestor@6wla.local");
  const membro = await cliente("membro@6wla.local");
  const intruso = await cliente("outro@6wla.local");
  const id = `QA-RLS-${Date.now()}`;
  const registro = {
    obra_id: obraId,
    id_atividade: id,
    nome_atividade: "Atividade isolada",
    semana: "S-38",
    quantidade_prevista: 10,
    inicio_semana: "2026-09-14",
    termino_semana: "2026-09-20",
  };
  try {
    const criado = await gestor
      .from("atividades_ppc")
      .insert(registro)
      .select("id")
      .single();
    expect(criado.error).toBeNull();
    if (!criado.data) throw new Error("Registro de teste não criado.");
    expect(
      (
        await membro
          .from("atividades_ppc")
          .select("id")
          .eq("id", criado.data.id)
      ).data,
    ).toHaveLength(1);
    expect(
      (
        await intruso
          .from("atividades_ppc")
          .select("id")
          .eq("id", criado.data.id)
      ).data,
    ).toEqual([]);
    expect(
      (
        await intruso
          .from("atividades_ppc")
          .update({ quantidade_realizada: 99 })
          .eq("id", criado.data.id)
          .select("id")
      ).data,
    ).toEqual([]);
    expect(
      (
        await membro
          .from("atividades_ppc")
          .update({ quantidade_realizada: 99 })
          .eq("id", criado.data.id)
          .select("id")
      ).data,
    ).toEqual([]);
    expect(
      (
        await membro
          .from("atividades_ppc")
          .insert({ ...registro, id_atividade: `${id}-membro` })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await gestor
          .from("atividades_ppc")
          .insert({ ...registro, obra_id: outraObra })
      ).error,
    ).not.toBeNull();
    const leitura = await gestor
      .from("atividades_ppc")
      .select("quantidade_realizada")
      .eq("id", criado.data.id)
      .single();
    expect(leitura.data?.quantidade_realizada).toBeNull();
  } finally {
    const { error } = await gestor
      .from("atividades_ppc")
      .delete()
      .eq("obra_id", obraId)
      .eq("id_atividade", id);
    if (error) throw new Error("Falha ao limpar o registro de teste RLS.");
    await Promise.all([
      gestor.auth.signOut(),
      membro.auth.signOut(),
      intruso.auth.signOut(),
    ]);
  }
});

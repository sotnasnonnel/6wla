import { describe, expect, it } from "vitest";
import {
  formataInstante,
  hojeNoFuso,
  horarioDevido,
  instanteDoRelogio,
  proximaExecucao,
  resumoDias,
} from "./agenda";

const SEG_A_SEX = {
  dias: [1, 2, 3, 4, 5],
  hora: "07:30:00",
  fuso: "America/Sao_Paulo",
};

// 2026-09-16 é quarta-feira; São Paulo = UTC-3.
const SLOT_QUARTA = new Date("2026-09-16T10:30:00Z");

describe("horarioDevido", () => {
  it("dispara o horário de hoje logo depois dele", () => {
    const agora = new Date("2026-09-16T10:40:00Z");
    expect(
      horarioDevido({ agora, agenda: SEG_A_SEX, ultimoDisparo: null }),
    ).toEqual(SLOT_QUARTA);
  });

  it("não dispara antes da hora", () => {
    const agora = new Date("2026-09-16T10:20:00Z");
    expect(
      horarioDevido({ agora, agenda: SEG_A_SEX, ultimoDisparo: null }),
    ).toBeNull();
  });

  it("não dispara de novo um horário já tratado", () => {
    const agora = new Date("2026-09-16T10:45:00Z");
    expect(
      horarioDevido({ agora, agenda: SEG_A_SEX, ultimoDisparo: SLOT_QUARTA }),
    ).toBeNull();
  });

  it("não dispara horário que saiu da janela de 60 min", () => {
    const agora = new Date("2026-09-16T11:31:00Z");
    expect(
      horarioDevido({ agora, agenda: SEG_A_SEX, ultimoDisparo: null }),
    ).toBeNull();
  });

  it("não dispara em dia fora da agenda (sábado)", () => {
    const agora = new Date("2026-09-19T10:40:00Z");
    expect(
      horarioDevido({ agora, agenda: SEG_A_SEX, ultimoDisparo: null }),
    ).toBeNull();
  });

  it("pega o horário de ontem quando a janela cruza a meia-noite local", () => {
    const agenda = { dias: [3], hora: "23:50", fuso: "America/Sao_Paulo" };
    // Quinta 00:10 local = quinta 03:10Z; o horário é quarta 23:50 local.
    const agora = new Date("2026-09-17T03:10:00Z");
    expect(horarioDevido({ agora, agenda, ultimoDisparo: null })).toEqual(
      new Date("2026-09-17T02:50:00Z"),
    );
  });

  it("devolve null para fuso inválido", () => {
    const agenda = { ...SEG_A_SEX, fuso: "Marte/Olimpo" };
    expect(
      horarioDevido({
        agora: new Date("2026-09-16T10:40:00Z"),
        agenda,
        ultimoDisparo: null,
      }),
    ).toBeNull();
  });
});

describe("instanteDoRelogio", () => {
  it("respeita o horário de verão do fuso", () => {
    // Nova York em julho = UTC-4.
    expect(instanteDoRelogio(2026, 7, 1, 7, 30, "America/New_York")).toEqual(
      new Date("2026-07-01T11:30:00Z"),
    );
  });
});

describe("proximaExecucao", () => {
  it("pula o fim de semana", () => {
    const sexta = new Date("2026-09-18T12:00:00Z");
    expect(proximaExecucao(sexta, SEG_A_SEX)).toEqual(
      new Date("2026-09-21T10:30:00Z"),
    );
  });
});

describe("resumoDias", () => {
  it("resume dias úteis como intervalo", () => {
    expect(resumoDias([5, 1, 2, 3, 4])).toBe("Seg a sex");
  });

  it("lista dias salteados", () => {
    expect(resumoDias([1, 3, 5])).toBe("Seg, qua, sex");
  });
});

describe("formatação no fuso", () => {
  it("mostra o instante no relógio local", () => {
    expect(formataInstante(SLOT_QUARTA, "America/Sao_Paulo")).toBe(
      "Qua, 16/09 às 07:30",
    );
  });

  it("calcula o dia local, não o UTC", () => {
    expect(
      hojeNoFuso(new Date("2026-09-17T01:00:00Z"), "America/Sao_Paulo"),
    ).toBe("2026-09-16");
  });
});

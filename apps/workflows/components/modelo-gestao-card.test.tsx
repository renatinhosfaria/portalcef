import type { WorkflowModeloResumo } from "@essencia/shared/types/workflows";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ModeloGestaoCard } from "./modelo-gestao-card";

const categoria = {
  id: "categoria-1",
  schoolId: "school-1",
  unitId: "unit-1",
  nome: "Eventos",
  ativo: true,
  ordem: 1,
  createdAt: "2026-07-30T10:00:00.000Z",
  updatedAt: "2026-07-30T10:00:00.000Z",
};

function criarModelo(
  status: WorkflowModeloResumo["status"],
): WorkflowModeloResumo {
  return {
    id: `modelo-${status.toLowerCase()}`,
    schoolId: "school-1",
    unitId: "unit-1",
    categoriaId: categoria.id,
    nome: `Modelo ${status}`,
    descricaoCurta: "Protocolo operacional",
    status,
    criadoPor: "gestor-1",
    createdAt: "2026-07-30T10:00:00.000Z",
    updatedAt: "2026-07-30T10:00:00.000Z",
    categoria,
  };
}

describe("ModeloGestaoCard", () => {
  it.each(["RASCUNHO", "PUBLICADO", "INATIVO"] as const)(
    "oferece edição para modelo %s",
    (status) => {
      const modelo = criarModelo(status);

      render(<ModeloGestaoCard modelo={modelo} onIniciarTeste={vi.fn()} />);

      expect(
        screen.getByRole("link", { name: `Editar ${modelo.nome}` }),
      ).toHaveAttribute("href", `/modelos/${modelo.id}`);
    },
  );

  it("oferece início de teste somente para rascunho", async () => {
    const user = userEvent.setup();
    const modelo = criarModelo("RASCUNHO");
    const onIniciarTeste = vi.fn();

    const { rerender } = render(
      <ModeloGestaoCard
        modelo={modelo}
        onIniciarTeste={onIniciarTeste}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: `Iniciar teste de ${modelo.nome}` }),
    );
    expect(onIniciarTeste).toHaveBeenCalledWith(modelo);

    rerender(
      <ModeloGestaoCard
        modelo={criarModelo("INATIVO")}
        onIniciarTeste={onIniciarTeste}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Iniciar teste/ }),
    ).not.toBeInTheDocument();
  });
});


// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CupomEditor } from "./cupom-editor";
import { cupomInicial } from "./cupons-contratos";

describe("CupomEditor", () => {
  it("edita os campos do cupom e não permite apagar cupom usado", () => {
    const onChange = vi.fn();
    render(<CupomEditor value={{ ...cupomInicial, id: "c1", confirmedUses: 2 }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Código do cupom"), { target: { value: "novo" } });
    fireEvent.change(screen.getByLabelText("Percentual de desconto"), { target: { value: "100" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ code: "novo" }));
    expect(screen.getByText(/2 uso/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Excluir cupom/i })).toBeNull();
  });
});

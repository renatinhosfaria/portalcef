import { expect, it } from "vitest";
import { precoPrincipalPublico } from "../eventos-formatters";
it("mantém preço avulso principal mesmo quando o pacote custa menos",()=>{
  const inteira={name:"Inteira",priceCents:4500,lugaresPorPacote:1};
  const combo={name:"Combo Inteira",priceCents:1000,lugaresPorPacote:10};
  expect(precoPrincipalPublico([inteira,combo])).toBe(4500);
  expect(precoPrincipalPublico([combo])).toBeNull();
  expect(precoPrincipalPublico([{name:"Meia",priceCents:2250}])).toBe(2250);
});

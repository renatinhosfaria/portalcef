export type ClienteParaLog = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

export function mascararEmail(email?: string | null): string | null {
  if (!email) return null;

  const partes = email.split("@");
  if (partes.length !== 2) return "***";

  return `***@${partes[1]}`;
}

export function mascararTelefone(telefone?: string | null): string | null {
  if (!telefone) return null;

  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length <= 4) {
    return `***${digitos}`;
  }

  const ultimos = digitos.slice(-4);
  return `****${ultimos}`;
}

export function sanitizarClienteParaLog(cliente?: ClienteParaLog | null) {
  if (!cliente) return null;

  return {
    name: cliente.name ? "REMOVIDO" : null,
    phone: mascararTelefone(cliente.phone),
    email: mascararEmail(cliente.email),
  };
}
